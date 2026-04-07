
-- Fix: Only check border-category extras for routing, not ALL extras
CREATE OR REPLACE FUNCTION public.assign_station_on_order_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
                 COALESCE((SELECT string_agg(lower(oie.extra_name), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id AND oie.kds_category = 'border'), '') as border_extras_text,
                 COALESCE((SELECT string_agg(lower(sie.group_name || ' ' || sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id AND sie.kds_category = 'border'), '') as sub_border_extras_text
          FROM order_items oi
          WHERE oi.order_id = NEW.id AND oi.current_station_id IS NULL
            AND (oi.station_status IS NULL OR oi.station_status = 'waiting')
        LOOP
          has_border := FALSE;
          IF item_record.border_extras_text != '' OR item_record.sub_border_extras_text != '' THEN
            has_border := TRUE;
          ELSE
            combined_text := lower(COALESCE(item_record.notes, ''));
            FOREACH kw IN ARRAY border_kws LOOP
              IF combined_text LIKE '%' || lower(kw) || '%' THEN has_border := TRUE; EXIT; END IF;
            END LOOP;
          END IF;

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
$function$;
