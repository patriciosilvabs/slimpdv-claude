
-- Fix keyword matching to only search in OPTION names, not GROUP names
-- The extra_name format is "Group: # Option" or "Group: Option"
-- We need to extract only the option part for keyword matching

-- Helper: extract option name from extra_name (part after last ':' or '#')
CREATE OR REPLACE FUNCTION public.extract_option_from_extra_name(_extra_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN position('#' in _extra_name) > 0 THEN
      trim(substring(_extra_name from position('#' in _extra_name) + 1))
    WHEN position(':' in _extra_name) > 0 THEN
      trim(substring(_extra_name from position(':' in _extra_name) + 1))
    ELSE
      _extra_name
  END
$$;

-- Update assign_station_on_order_confirm to use option-only matching
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
                 -- Extras with kds_category = 'border'
                 COALESCE((SELECT string_agg(lower(oie.extra_name), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id AND oie.kds_category = 'border'), '') as border_extras_text,
                 -- Sub-extras with kds_category = 'border'
                 COALESCE((SELECT string_agg(lower(sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id AND sie.kds_category = 'border'), '') as sub_border_extras_text,
                 -- OPTION names only from extras (extracted after : or #)
                 COALESCE((SELECT string_agg(lower(extract_option_from_extra_name(oie.extra_name)), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id), '') as all_extras_options_text,
                 -- OPTION names only from sub-extras
                 COALESCE((SELECT string_agg(lower(sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id), '') as all_sub_extras_options_text
          FROM order_items oi
          WHERE oi.order_id = NEW.id AND oi.current_station_id IS NULL
            AND (oi.station_status IS NULL OR oi.station_status = 'waiting')
        LOOP
          has_border := FALSE;
          
          -- Priority 1: explicit kds_category = 'border'
          IF item_record.border_extras_text != '' OR item_record.sub_border_extras_text != '' THEN
            has_border := TRUE;
          ELSE
            -- Priority 2: keyword search in OPTION names only + notes
            combined_text := lower(COALESCE(item_record.notes, '')) || ' ' || item_record.all_extras_options_text || ' ' || item_record.all_sub_extras_options_text;
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

-- Update reroute_item_if_border to use option-only matching
CREATE OR REPLACE FUNCTION public.reroute_item_if_border(_item_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_routing_mode TEXT;
  border_kws TEXT[];
  kw TEXT;
  combined_text TEXT;
  edge_sector_id UUID;
  target_sector_id UUID;
  has_border BOOLEAN := FALSE;
BEGIN
  SELECT oi.id, oi.current_station_id, oi.station_status, oi.has_edge, oi.tenant_id, oi.notes,
         ks.is_edge_sector
  INTO v_item
  FROM order_items oi
  LEFT JOIN kds_stations ks ON ks.id = oi.current_station_id
  WHERE oi.id = _item_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_item.station_status != 'waiting' OR v_item.has_edge = true THEN RETURN FALSE; END IF;
  IF v_item.is_edge_sector = true THEN RETURN FALSE; END IF;

  SELECT routing_mode, border_keywords INTO v_routing_mode, border_kws
  FROM kds_global_settings WHERE tenant_id = v_item.tenant_id LIMIT 1;

  IF COALESCE(v_routing_mode, 'sequential') != 'smart' THEN RETURN FALSE; END IF;
  IF border_kws IS NULL OR array_length(border_kws, 1) IS NULL THEN RETURN FALSE; END IF;

  -- Check for kds_category = 'border' first
  IF EXISTS (SELECT 1 FROM order_item_extras WHERE order_item_id = _item_id AND kds_category = 'border') THEN
    has_border := TRUE;
  ELSIF EXISTS (
    SELECT 1 FROM order_item_sub_items si
    JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id
    WHERE si.order_item_id = _item_id AND sie.kds_category = 'border'
  ) THEN
    has_border := TRUE;
  ELSE
    -- Keyword fallback: search OPTION names only (not group names)
    SELECT COALESCE(string_agg(lower(extract_option_from_extra_name(oie.extra_name)), ' '), '') INTO combined_text
    FROM order_item_extras oie WHERE oie.order_item_id = _item_id;

    -- For sub-extras, only use option_name (not group_name)
    combined_text := combined_text || ' ' || COALESCE((
      SELECT string_agg(lower(sie.option_name), ' ')
      FROM order_item_sub_items si
      JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id
      WHERE si.order_item_id = _item_id
    ), '');

    combined_text := combined_text || ' ' || lower(COALESCE(v_item.notes, ''));

    FOREACH kw IN ARRAY border_kws LOOP
      IF combined_text LIKE '%' || lower(kw) || '%' THEN has_border := TRUE; EXIT; END IF;
    END LOOP;
  END IF;

  IF NOT has_border THEN RETURN FALSE; END IF;

  SELECT id INTO edge_sector_id
  FROM kds_stations
  WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = v_item.tenant_id
  ORDER BY sort_order ASC LIMIT 1;

  IF edge_sector_id IS NULL THEN RETURN FALSE; END IF;

  target_sector_id := get_least_loaded_sector_online(v_item.tenant_id);
  IF target_sector_id IS NULL THEN target_sector_id := v_item.current_station_id; END IF;

  UPDATE order_items
  SET current_station_id = edge_sector_id,
      next_sector_id = target_sector_id,
      has_edge = true
  WHERE id = _item_id;

  RETURN TRUE;
END;
$function$;
