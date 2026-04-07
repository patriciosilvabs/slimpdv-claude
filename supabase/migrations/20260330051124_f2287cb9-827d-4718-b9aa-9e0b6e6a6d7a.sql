
-- Add logistics columns to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS logistics_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logistics_group_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood text DEFAULT NULL;

-- Create delivery_logistics_groups table
CREATE TABLE IF NOT EXISTS public.delivery_logistics_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  strategy text NOT NULL DEFAULT 'neighborhood',
  status text NOT NULL DEFAULT 'buffering',
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  estimated_route_km numeric
);

-- Add FK from orders to logistics groups
ALTER TABLE public.orders
  ADD CONSTRAINT orders_logistics_group_id_fkey
  FOREIGN KEY (logistics_group_id) REFERENCES public.delivery_logistics_groups(id) ON DELETE SET NULL;

-- RLS on delivery_logistics_groups
ALTER TABLE public.delivery_logistics_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view logistics groups"
  ON public.delivery_logistics_groups FOR SELECT
  TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can insert logistics groups"
  ON public.delivery_logistics_groups FOR INSERT
  TO authenticated
  WITH CHECK (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can update logistics groups"
  ON public.delivery_logistics_groups FOR UPDATE
  TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

-- Service role policy for edge function
CREATE POLICY "Service role full access logistics groups"
  ON public.delivery_logistics_groups FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Modify assign_station_on_order_confirm to check logistics buffer
CREATE OR REPLACE FUNCTION public.assign_station_on_order_confirm()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
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
  v_logistics_enabled BOOLEAN := FALSE;
  v_buffer_minutes INTEGER := 3;
  v_logistics_config JSONB;
BEGIN
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN

    -- Check if delivery logistics buffer is enabled for delivery orders
    IF NEW.order_type = 'delivery' THEN
      SELECT value::jsonb INTO v_logistics_config
      FROM global_settings
      WHERE tenant_id = NEW.tenant_id AND key = 'delivery_logistics'
      LIMIT 1;

      IF v_logistics_config IS NOT NULL AND (v_logistics_config->>'enabled')::boolean = true THEN
        v_logistics_enabled := TRUE;
        v_buffer_minutes := COALESCE((v_logistics_config->>'buffer_minutes')::integer, 3);
      END IF;
    END IF;

    -- If logistics buffer is enabled for this delivery order, hold it
    IF v_logistics_enabled THEN
      NEW.logistics_status := 'buffered';
      NEW.geocode_status := 'pending';
      -- Extract neighborhood from delivery_address if available
      IF NEW.delivery_address IS NOT NULL THEN
        NEW.delivery_neighborhood := NEW.delivery_address;
      END IF;
      -- Do NOT assign stations - items stay without current_station_id
      RETURN NEW;
    END IF;

    -- Normal flow (unchanged)
    SELECT routing_mode, border_keywords INTO v_routing_mode, border_kws
    FROM kds_global_settings WHERE tenant_id = NEW.tenant_id LIMIT 1;
    v_routing_mode := COALESCE(v_routing_mode, 'sequential');
    IF v_routing_mode = 'sequential' THEN
      SELECT id INTO first_station_id FROM kds_stations
      WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = NEW.tenant_id
      ORDER BY sort_order ASC LIMIT 1;
      IF first_station_id IS NOT NULL THEN
        UPDATE order_items SET current_station_id = first_station_id, station_status = 'waiting', next_sector_id = NULL, has_edge = false
        WHERE order_id = NEW.id AND current_station_id IS NULL AND (station_status IS NULL OR station_status = 'waiting');
      END IF;
    ELSE
      IF border_kws IS NULL OR array_length(border_kws, 1) IS NULL OR array_length(border_kws, 1) = 0 THEN
        SELECT id INTO first_station_id FROM kds_stations
        WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = NEW.tenant_id
        ORDER BY sort_order ASC LIMIT 1;
        IF first_station_id IS NOT NULL THEN
          UPDATE order_items SET current_station_id = first_station_id, station_status = 'waiting', next_sector_id = NULL, has_edge = false
          WHERE order_id = NEW.id AND current_station_id IS NULL AND (station_status IS NULL OR station_status = 'waiting');
        END IF;
      ELSE
        SELECT id INTO edge_sector_id FROM kds_stations
        WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = NEW.tenant_id
        ORDER BY sort_order ASC LIMIT 1;
        FOR item_record IN
          SELECT oi.id, oi.notes,
                 COALESCE((SELECT string_agg(lower(oie.extra_name), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id AND oie.kds_category = 'border'), '') as border_extras_text,
                 COALESCE((SELECT string_agg(lower(sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id AND sie.kds_category = 'border'), '') as sub_border_extras_text,
                 COALESCE((SELECT string_agg(lower(extract_option_from_extra_name(oie.extra_name)), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id), '') as all_extras_options_text,
                 COALESCE((SELECT string_agg(lower(sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id), '') as all_sub_extras_options_text
          FROM order_items oi
          WHERE oi.order_id = NEW.id AND oi.current_station_id IS NULL AND (oi.station_status IS NULL OR oi.station_status = 'waiting')
        LOOP
          has_border := FALSE;
          IF item_record.border_extras_text != '' OR item_record.sub_border_extras_text != '' THEN
            has_border := TRUE;
          ELSE
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

-- Modify auto_initialize_new_order_item to check logistics buffer
CREATE OR REPLACE FUNCTION public.auto_initialize_new_order_item()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  first_station_id UUID;
  edge_sector_id UUID;
  target_sector_id UUID;
  order_is_draft BOOLEAN;
  order_current_status TEXT;
  order_tenant_id UUID;
  order_logistics_status TEXT;
  has_border BOOLEAN;
  border_kws TEXT[];
  kw TEXT;
  combined_text TEXT;
  v_routing_mode TEXT;
BEGIN
  SELECT is_draft, status, tenant_id, logistics_status INTO order_is_draft, order_current_status, order_tenant_id, order_logistics_status
  FROM orders WHERE id = NEW.order_id;

  -- If order is in logistics buffer, do not assign station
  IF order_logistics_status = 'buffered' THEN
    RETURN NEW;
  END IF;

  IF (order_is_draft = FALSE AND NEW.current_station_id IS NULL) THEN
    SELECT routing_mode, border_keywords INTO v_routing_mode, border_kws
    FROM kds_global_settings WHERE tenant_id = order_tenant_id LIMIT 1;
    v_routing_mode := COALESCE(v_routing_mode, 'sequential');
    IF v_routing_mode = 'sequential' THEN
      SELECT id INTO first_station_id FROM kds_stations WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = order_tenant_id ORDER BY sort_order ASC LIMIT 1;
      IF first_station_id IS NOT NULL THEN
        NEW.current_station_id := first_station_id; NEW.station_status := 'waiting'; NEW.next_sector_id := NULL; NEW.has_edge := false;
      END IF;
    ELSE
      IF border_kws IS NULL OR array_length(border_kws, 1) IS NULL OR array_length(border_kws, 1) = 0 THEN
        SELECT id INTO first_station_id FROM kds_stations WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = order_tenant_id ORDER BY sort_order ASC LIMIT 1;
        IF first_station_id IS NOT NULL THEN
          NEW.current_station_id := first_station_id; NEW.station_status := 'waiting'; NEW.next_sector_id := NULL; NEW.has_edge := false;
        END IF;
      ELSE
        SELECT id INTO edge_sector_id FROM kds_stations WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = order_tenant_id ORDER BY sort_order ASC LIMIT 1;
        combined_text := lower(COALESCE(NEW.notes, ''));
        has_border := FALSE;
        FOREACH kw IN ARRAY border_kws LOOP
          IF combined_text LIKE '%' || lower(kw) || '%' THEN has_border := TRUE; EXIT; END IF;
        END LOOP;
        target_sector_id := get_least_loaded_sector_online(order_tenant_id);
        IF target_sector_id IS NULL THEN target_sector_id := edge_sector_id; END IF;
        IF has_border AND edge_sector_id IS NOT NULL THEN
          NEW.current_station_id := edge_sector_id; NEW.next_sector_id := target_sector_id; NEW.has_edge := true; NEW.station_status := 'waiting';
        ELSE
          NEW.current_station_id := COALESCE(target_sector_id, edge_sector_id); NEW.has_edge := false; NEW.station_status := 'waiting';
        END IF;
      END IF;
    END IF;
    IF order_current_status = 'delivered' THEN
      UPDATE orders SET status = 'preparing', ready_at = NULL, updated_at = now() WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Function to release buffered orders (called by edge function)
CREATE OR REPLACE FUNCTION public.release_buffered_order(_order_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
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
  SELECT id, tenant_id, logistics_status INTO v_order
  FROM orders WHERE id = _order_id FOR UPDATE;

  IF NOT FOUND OR v_order.logistics_status NOT IN ('buffered', 'grouped') THEN
    RETURN FALSE;
  END IF;

  -- Mark as released
  UPDATE orders SET logistics_status = 'released' WHERE id = _order_id;

  -- Now assign stations (same logic as normal confirm)
  SELECT routing_mode, border_keywords INTO v_routing_mode, border_kws
  FROM kds_global_settings WHERE tenant_id = v_order.tenant_id LIMIT 1;
  v_routing_mode := COALESCE(v_routing_mode, 'sequential');

  IF v_routing_mode = 'sequential' THEN
    SELECT id INTO first_station_id FROM kds_stations
    WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = v_order.tenant_id
    ORDER BY sort_order ASC LIMIT 1;
    IF first_station_id IS NOT NULL THEN
      UPDATE order_items SET current_station_id = first_station_id, station_status = 'waiting', next_sector_id = NULL, has_edge = false
      WHERE order_id = _order_id AND current_station_id IS NULL AND (station_status IS NULL OR station_status = 'waiting');
    END IF;
  ELSE
    IF border_kws IS NULL OR array_length(border_kws, 1) IS NULL OR array_length(border_kws, 1) = 0 THEN
      SELECT id INTO first_station_id FROM kds_stations
      WHERE is_active = TRUE AND station_type != 'order_status' AND tenant_id = v_order.tenant_id
      ORDER BY sort_order ASC LIMIT 1;
      IF first_station_id IS NOT NULL THEN
        UPDATE order_items SET current_station_id = first_station_id, station_status = 'waiting', next_sector_id = NULL, has_edge = false
        WHERE order_id = _order_id AND current_station_id IS NULL AND (station_status IS NULL OR station_status = 'waiting');
      END IF;
    ELSE
      SELECT id INTO edge_sector_id FROM kds_stations
      WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = v_order.tenant_id
      ORDER BY sort_order ASC LIMIT 1;
      FOR item_record IN
        SELECT oi.id, oi.notes,
               COALESCE((SELECT string_agg(lower(oie.extra_name), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id AND oie.kds_category = 'border'), '') as border_extras_text,
               COALESCE((SELECT string_agg(lower(sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id AND sie.kds_category = 'border'), '') as sub_border_extras_text,
               COALESCE((SELECT string_agg(lower(extract_option_from_extra_name(oie.extra_name)), ' ') FROM order_item_extras oie WHERE oie.order_item_id = oi.id), '') as all_extras_options_text,
               COALESCE((SELECT string_agg(lower(sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = oi.id), '') as all_sub_extras_options_text
        FROM order_items oi
        WHERE oi.order_id = _order_id AND oi.current_station_id IS NULL AND (oi.station_status IS NULL OR oi.station_status = 'waiting')
      LOOP
        has_border := FALSE;
        IF item_record.border_extras_text != '' OR item_record.sub_border_extras_text != '' THEN
          has_border := TRUE;
        ELSE
          combined_text := lower(COALESCE(item_record.notes, '')) || ' ' || item_record.all_extras_options_text || ' ' || item_record.all_sub_extras_options_text;
          FOREACH kw IN ARRAY border_kws LOOP
            IF combined_text LIKE '%' || lower(kw) || '%' THEN has_border := TRUE; EXIT; END IF;
          END LOOP;
        END IF;
        target_sector_id := get_least_loaded_sector_online(v_order.tenant_id);
        IF target_sector_id IS NULL THEN target_sector_id := edge_sector_id; END IF;
        IF has_border AND edge_sector_id IS NOT NULL THEN
          UPDATE order_items SET current_station_id = edge_sector_id, next_sector_id = target_sector_id, has_edge = true, station_status = 'waiting' WHERE id = item_record.id;
        ELSE
          UPDATE order_items SET current_station_id = COALESCE(target_sector_id, edge_sector_id), has_edge = false, station_status = 'waiting' WHERE id = item_record.id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN TRUE;
END;
$function$;
