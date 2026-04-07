
CREATE OR REPLACE FUNCTION assign_station_on_order_confirm()
RETURNS TRIGGER AS $$
DECLARE
  first_station_id UUID;
  edge_sector_id UUID;
  target_sector_id UUID;
  item_record RECORD;
  has_border BOOLEAN;
  border_kws TEXT[];
  kw TEXT;
  combined_text TEXT;
  v_routing_mode TEXT;
BEGIN
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN

    SELECT routing_mode, border_keywords INTO v_routing_mode, border_kws
    FROM kds_global_settings
    WHERE tenant_id = NEW.tenant_id
    LIMIT 1;

    v_routing_mode := COALESCE(v_routing_mode, 'sequential');

    IF v_routing_mode = 'sequential' THEN
      SELECT id INTO first_station_id
      FROM kds_stations
      WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = NEW.tenant_id
      ORDER BY sort_order ASC LIMIT 1;

      IF first_station_id IS NOT NULL THEN
        UPDATE order_items
        SET current_station_id = first_station_id, station_status = 'waiting',
            next_sector_id = NULL, has_edge = false
        WHERE order_id = NEW.id AND current_station_id IS NULL
          AND (station_status IS NULL OR station_status = 'waiting');
      END IF;
    ELSE
      IF border_kws IS NULL OR array_length(border_kws, 1) IS NULL OR array_length(border_kws, 1) = 0 THEN
        SELECT id INTO first_station_id
        FROM kds_stations
        WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = NEW.tenant_id
        ORDER BY sort_order ASC LIMIT 1;

        IF first_station_id IS NOT NULL THEN
          UPDATE order_items
          SET current_station_id = first_station_id, station_status = 'waiting',
              next_sector_id = NULL, has_edge = false
          WHERE order_id = NEW.id AND current_station_id IS NULL
            AND (station_status IS NULL OR station_status = 'waiting');
        END IF;
      ELSE
        SELECT id INTO edge_sector_id
        FROM kds_stations
        WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = NEW.tenant_id
        ORDER BY sort_order ASC LIMIT 1;

        FOR item_record IN
          SELECT oi.id, oi.notes,
                 COALESCE((SELECT string_agg(lower(oie.extra_name), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id), '') as extras_text,
                 COALESCE((SELECT string_agg(lower(sie.group_name || ' ' || sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id), '') as sub_extras_text
          FROM order_items oi
          WHERE oi.order_id = NEW.id AND oi.current_station_id IS NULL
            AND (oi.station_status IS NULL OR oi.station_status = 'waiting')
        LOOP
          has_border := FALSE;
          combined_text := lower(COALESCE(item_record.notes, '') || ' ' || item_record.extras_text || ' ' || item_record.sub_extras_text);
          FOREACH kw IN ARRAY border_kws LOOP
            IF combined_text LIKE '%' || lower(kw) || '%' THEN has_border := TRUE; EXIT; END IF;
          END LOOP;

          target_sector_id := get_least_loaded_sector_online(NEW.tenant_id);
          IF target_sector_id IS NULL THEN target_sector_id := edge_sector_id; END IF;

          IF has_border AND edge_sector_id IS NOT NULL THEN
            UPDATE order_items SET current_station_id = edge_sector_id, next_sector_id = target_sector_id, has_edge = true, station_status = 'waiting' WHERE id = item_record.id;
          ELSE
            UPDATE order_items SET current_station_id = COALESCE(target_sector_id, edge_sector_id), has_edge = false, station_status = 'waiting' WHERE id = item_record.id;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_initialize_new_order_item()
RETURNS TRIGGER AS $$
DECLARE
  first_station_id UUID;
  edge_sector_id UUID;
  target_sector_id UUID;
  order_is_draft BOOLEAN;
  order_current_status TEXT;
  order_tenant_id UUID;
  has_border BOOLEAN;
  border_kws TEXT[];
  kw TEXT;
  combined_text TEXT;
  extras_text TEXT;
  v_routing_mode TEXT;
BEGIN
  SELECT is_draft, status, tenant_id INTO order_is_draft, order_current_status, order_tenant_id
  FROM orders WHERE id = NEW.order_id;

  IF (order_is_draft = FALSE AND NEW.current_station_id IS NULL) THEN
    SELECT routing_mode, border_keywords INTO v_routing_mode, border_kws
    FROM kds_global_settings WHERE tenant_id = order_tenant_id LIMIT 1;

    v_routing_mode := COALESCE(v_routing_mode, 'sequential');

    IF v_routing_mode = 'sequential' THEN
      SELECT id INTO first_station_id
      FROM kds_stations WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = order_tenant_id
      ORDER BY sort_order ASC LIMIT 1;

      IF first_station_id IS NOT NULL THEN
        NEW.current_station_id := first_station_id;
        NEW.station_status := 'waiting';
        NEW.next_sector_id := NULL;
        NEW.has_edge := false;
      END IF;
    ELSE
      IF border_kws IS NULL OR array_length(border_kws, 1) IS NULL OR array_length(border_kws, 1) = 0 THEN
        SELECT id INTO first_station_id
        FROM kds_stations WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = order_tenant_id
        ORDER BY sort_order ASC LIMIT 1;

        IF first_station_id IS NOT NULL THEN
          NEW.current_station_id := first_station_id;
          NEW.station_status := 'waiting';
          NEW.next_sector_id := NULL;
          NEW.has_edge := false;
        END IF;
      ELSE
        SELECT id INTO edge_sector_id
        FROM kds_stations WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = order_tenant_id
        ORDER BY sort_order ASC LIMIT 1;

        -- Check notes first
        combined_text := lower(COALESCE(NEW.notes, ''));
        
        -- Also check extras already inserted for this item (if any exist)
        SELECT COALESCE(string_agg(lower(oie.extra_name), ' '), '') INTO extras_text
        FROM order_item_extras oie WHERE oie.order_item_id = NEW.id;
        
        combined_text := combined_text || ' ' || extras_text;
        
        -- Also check sub_item_extras
        SELECT COALESCE(string_agg(lower(sie.group_name || ' ' || sie.option_name), ' '), '') INTO extras_text
        FROM order_item_sub_items si
        JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id
        WHERE si.order_item_id = NEW.id;
        
        combined_text := combined_text || ' ' || extras_text;

        has_border := FALSE;
        FOREACH kw IN ARRAY border_kws LOOP
          IF combined_text LIKE '%' || lower(kw) || '%' THEN has_border := TRUE; EXIT; END IF;
        END LOOP;

        target_sector_id := get_least_loaded_sector_online(order_tenant_id);
        IF target_sector_id IS NULL THEN target_sector_id := edge_sector_id; END IF;

        IF has_border AND edge_sector_id IS NOT NULL THEN
          NEW.current_station_id := edge_sector_id;
          NEW.next_sector_id := target_sector_id;
          NEW.has_edge := true;
          NEW.station_status := 'waiting';
        ELSE
          NEW.current_station_id := COALESCE(target_sector_id, edge_sector_id);
          NEW.has_edge := false;
          NEW.station_status := 'waiting';
        END IF;
      END IF;
    END IF;

    IF order_current_status = 'delivered' THEN
      UPDATE orders SET status = 'preparing', ready_at = NULL, updated_at = now() WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
