
-- Replace the trigger function to do smart routing:
-- Items WITH border extras → Borda station (sort_order 0)
-- Items WITHOUT border → Least-busy prep station (Recheio A or B)
CREATE OR REPLACE FUNCTION public.assign_station_on_order_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  borda_station_id UUID;
  prep_station_a_id UUID;
  prep_station_b_id UUID;
  count_a INT;
  count_b INT;
  target_prep_id UUID;
  item_record RECORD;
  has_border BOOLEAN;
  border_kws TEXT[] := ARRAY['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'];
  kds_settings RECORD;
BEGIN
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN
    
    -- Load border keywords from kds_global_settings if available
    SELECT border_keywords INTO kds_settings
    FROM kds_global_settings
    WHERE tenant_id = NEW.tenant_id
    LIMIT 1;
    
    IF kds_settings.border_keywords IS NOT NULL AND array_length(kds_settings.border_keywords, 1) > 0 THEN
      border_kws := kds_settings.border_keywords;
    END IF;
    
    -- Find borda station (first station by sort_order, type prep_start)
    SELECT id INTO borda_station_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type != 'order_status'
      AND tenant_id = NEW.tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;
    
    -- Find prep stations (item_assembly type, sort_order 1)
    SELECT id INTO prep_station_a_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type = 'item_assembly'
      AND tenant_id = NEW.tenant_id
    ORDER BY sort_order ASC, name ASC
    LIMIT 1;
    
    SELECT id INTO prep_station_b_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type = 'item_assembly'
      AND tenant_id = NEW.tenant_id
      AND id != COALESCE(prep_station_a_id, '00000000-0000-0000-0000-000000000000')
    ORDER BY sort_order ASC, name ASC
    LIMIT 1;
    
    -- If no prep stations found, fall back to borda for everything
    IF prep_station_a_id IS NULL THEN
      UPDATE order_items
      SET current_station_id = borda_station_id,
          station_status = 'waiting'
      WHERE order_id = NEW.id
        AND current_station_id IS NULL;
      RETURN NEW;
    END IF;
    
    -- Count current items in each prep station for load balancing
    SELECT COUNT(*) INTO count_a
    FROM order_items
    WHERE current_station_id = prep_station_a_id
      AND station_status IN ('waiting', 'in_progress');
    
    IF prep_station_b_id IS NOT NULL THEN
      SELECT COUNT(*) INTO count_b
      FROM order_items
      WHERE current_station_id = prep_station_b_id
        AND station_status IN ('waiting', 'in_progress');
    ELSE
      count_b := 999999; -- No station B, always use A
    END IF;
    
    -- Pick the least-busy prep station for this ORDER (all items go to same one)
    IF count_a <= count_b THEN
      target_prep_id := prep_station_a_id;
    ELSE
      target_prep_id := prep_station_b_id;
    END IF;
    
    -- Process each item individually
    FOR item_record IN 
      SELECT oi.id, oi.notes,
             COALESCE(
               (SELECT string_agg(lower(oie.extra_name), ' ')
                FROM order_item_extras oie 
                WHERE oie.order_item_id = oi.id),
               ''
             ) as extras_text,
             COALESCE(
               (SELECT string_agg(lower(sie.option_name), ' ')
                FROM order_item_sub_items si
                JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id
                WHERE si.order_item_id = oi.id AND sie.kds_category = 'border'),
               ''
             ) as border_extras_text
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.current_station_id IS NULL
        AND (oi.station_status IS NULL OR oi.station_status = 'waiting')
    LOOP
      -- Check if item has border
      has_border := FALSE;
      DECLARE
        kw TEXT;
        combined_text TEXT;
      BEGIN
        combined_text := lower(COALESCE(item_record.notes, '') || ' ' || item_record.extras_text || ' ' || item_record.border_extras_text);
        FOREACH kw IN ARRAY border_kws LOOP
          IF combined_text LIKE '%' || lower(kw) || '%' THEN
            has_border := TRUE;
            EXIT;
          END IF;
        END LOOP;
      END;
      
      IF has_border AND borda_station_id IS NOT NULL THEN
        -- Item with border → goes to borda station first
        UPDATE order_items
        SET current_station_id = borda_station_id,
            station_status = 'waiting'
        WHERE id = item_record.id;
      ELSE
        -- Item without border → goes directly to prep station
        UPDATE order_items
        SET current_station_id = target_prep_id,
            station_status = 'waiting'
        WHERE id = item_record.id;
      END IF;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Also update the function for new items added to existing orders
CREATE OR REPLACE FUNCTION public.auto_initialize_new_order_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  borda_station_id UUID;
  prep_station_a_id UUID;
  prep_station_b_id UUID;
  count_a INT;
  count_b INT;
  target_prep_id UUID;
  order_is_draft BOOLEAN;
  order_current_status TEXT;
  order_tenant_id UUID;
  has_border BOOLEAN;
  border_kws TEXT[] := ARRAY['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'];
  kds_settings RECORD;
  extras_text TEXT;
  combined_text TEXT;
  kw TEXT;
BEGIN
  SELECT is_draft, status, tenant_id INTO order_is_draft, order_current_status, order_tenant_id
  FROM orders
  WHERE id = NEW.order_id;
  
  IF (order_is_draft = FALSE AND NEW.current_station_id IS NULL) THEN
    
    -- Load border keywords
    SELECT border_keywords INTO kds_settings
    FROM kds_global_settings
    WHERE tenant_id = order_tenant_id
    LIMIT 1;
    
    IF kds_settings.border_keywords IS NOT NULL AND array_length(kds_settings.border_keywords, 1) > 0 THEN
      border_kws := kds_settings.border_keywords;
    END IF;
    
    -- Find borda station
    SELECT id INTO borda_station_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type != 'order_status'
      AND tenant_id = order_tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;
    
    -- Find prep stations
    SELECT id INTO prep_station_a_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type = 'item_assembly'
      AND tenant_id = order_tenant_id
    ORDER BY sort_order ASC, name ASC
    LIMIT 1;
    
    SELECT id INTO prep_station_b_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type = 'item_assembly'
      AND tenant_id = order_tenant_id
      AND id != COALESCE(prep_station_a_id, '00000000-0000-0000-0000-000000000000')
    ORDER BY sort_order ASC, name ASC
    LIMIT 1;
    
    IF prep_station_a_id IS NULL THEN
      NEW.current_station_id := borda_station_id;
      NEW.station_status := 'waiting';
    ELSE
      -- Check for border in item notes
      extras_text := '';
      combined_text := lower(COALESCE(NEW.notes, '') || ' ' || extras_text);
      
      has_border := FALSE;
      FOREACH kw IN ARRAY border_kws LOOP
        IF combined_text LIKE '%' || lower(kw) || '%' THEN
          has_border := TRUE;
          EXIT;
        END IF;
      END LOOP;
      
      IF has_border AND borda_station_id IS NOT NULL THEN
        NEW.current_station_id := borda_station_id;
        NEW.station_status := 'waiting';
      ELSE
        -- Load balance between prep stations
        SELECT COUNT(*) INTO count_a
        FROM order_items
        WHERE current_station_id = prep_station_a_id
          AND station_status IN ('waiting', 'in_progress');
        
        IF prep_station_b_id IS NOT NULL THEN
          SELECT COUNT(*) INTO count_b
          FROM order_items
          WHERE current_station_id = prep_station_b_id
            AND station_status IN ('waiting', 'in_progress');
        ELSE
          count_b := 999999;
        END IF;
        
        IF count_a <= count_b THEN
          target_prep_id := prep_station_a_id;
        ELSE
          target_prep_id := prep_station_b_id;
        END IF;
        
        NEW.current_station_id := target_prep_id;
        NEW.station_status := 'waiting';
      END IF;
    END IF;
    
    -- Reopen delivered orders
    IF order_current_status = 'delivered' THEN
      UPDATE orders 
      SET status = 'preparing', ready_at = NULL, updated_at = now()
      WHERE id = NEW.order_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;
