
CREATE OR REPLACE FUNCTION public.assign_station_on_order_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  borda_station_id UUID;
  all_prep_ids UUID[];
  prep_counts INT[];
  num_preps INT;
  min_idx INT;
  min_val INT;
  i INT;
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
    
    -- Find borda station (first station by sort_order, excluding order_status)
    SELECT id INTO borda_station_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type != 'order_status'
      AND tenant_id = NEW.tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;
    
    -- Find ALL prep stations (item_assembly type) into arrays
    SELECT array_agg(id ORDER BY sort_order ASC, name ASC)
    INTO all_prep_ids
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type = 'item_assembly'
      AND tenant_id = NEW.tenant_id;
    
    num_preps := COALESCE(array_length(all_prep_ids, 1), 0);
    
    -- If no prep stations found, fall back to borda for everything
    IF num_preps = 0 THEN
      UPDATE order_items
      SET current_station_id = borda_station_id,
          station_status = 'waiting'
      WHERE order_id = NEW.id
        AND current_station_id IS NULL;
      RETURN NEW;
    END IF;
    
    -- Initialize counts array with current queue sizes
    prep_counts := ARRAY[]::INT[];
    FOR i IN 1..num_preps LOOP
      SELECT COUNT(*)::INT INTO min_val
      FROM order_items
      WHERE current_station_id = all_prep_ids[i]
        AND station_status IN ('waiting', 'in_progress');
      prep_counts := array_append(prep_counts, min_val);
    END LOOP;
    
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
        -- Find least-busy prep station for THIS item
        min_idx := 1;
        min_val := prep_counts[1];
        FOR i IN 2..num_preps LOOP
          IF prep_counts[i] < min_val THEN
            min_val := prep_counts[i];
            min_idx := i;
          END IF;
        END LOOP;
        
        target_prep_id := all_prep_ids[min_idx];
        
        -- Assign item to least-busy station
        UPDATE order_items
        SET current_station_id = target_prep_id,
            station_status = 'waiting'
        WHERE id = item_record.id;
        
        -- Increment counter so next item sees updated load
        prep_counts[min_idx] := prep_counts[min_idx] + 1;
      END IF;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$function$;
