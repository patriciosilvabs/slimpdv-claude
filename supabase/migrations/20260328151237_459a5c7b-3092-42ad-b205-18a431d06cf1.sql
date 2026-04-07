-- 1. Fix can_bootstrap_admin to filter by tenant
CREATE OR REPLACE FUNCTION public.can_bootstrap_admin(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin' AND tenant_id = _tenant_id
  )
$function$;

-- 2. Fix has_permission to scope by tenant
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission permission_code, _tenant_id uuid DEFAULT NULL)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND granted = true
      AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
  )
$function$;

-- 3. Fix tenant_invitations policy - restrict "view by token" to only the invited email
DROP POLICY IF EXISTS "Users can view invitation by token" ON public.tenant_invitations;
CREATE POLICY "Users can view invitation by token"
  ON public.tenant_invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT auth.jwt() ->> 'email')
    OR belongs_to_tenant(tenant_id)
  );

-- 4. Restrict cardapioweb_integrations SELECT to admins only
DROP POLICY IF EXISTS "Tenant members can view cardapioweb integrations" ON public.cardapioweb_integrations;
CREATE POLICY "Tenant admins can view cardapioweb integrations"
  ON public.cardapioweb_integrations FOR SELECT
  TO authenticated
  USING (
    belongs_to_tenant(tenant_id) AND (
      has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR is_tenant_owner(tenant_id)
    )
  );

-- 5. Restrict production_api_keys SELECT to admins only
DROP POLICY IF EXISTS "Tenant members can view API keys" ON public.production_api_keys;
CREATE POLICY "Tenant admins can view API keys"
  ON public.production_api_keys FOR SELECT
  TO authenticated
  USING (
    belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

-- 6. Restrict kds_devices SELECT to admins
DROP POLICY IF EXISTS "Tenant members can view KDS devices" ON public.kds_devices;
CREATE POLICY "Tenant admins can view KDS devices"
  ON public.kds_devices FOR SELECT
  TO authenticated
  USING (
    belongs_to_tenant(tenant_id) AND (
      has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR is_tenant_owner(tenant_id)
    )
  );

-- 7. Fix search_path on assign_station_on_order_confirm
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
BEGIN
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN
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

-- Fix search_path on auto_initialize_new_order_item
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
  has_border BOOLEAN;
  border_kws TEXT[];
  kw TEXT;
  combined_text TEXT;
  v_routing_mode TEXT;
BEGIN
  SELECT is_draft, status, tenant_id INTO order_is_draft, order_current_status, order_tenant_id
  FROM orders WHERE id = NEW.order_id;
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

-- Fix search_path on auto_deduct_stock_for_extras
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_for_extras()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_record RECORD;
  order_item_record RECORD;
  option_ingredient RECORD;
  ingredient_record RECORD;
  deduction_quantity NUMERIC;
BEGIN
  SELECT oi.id, oi.quantity, oi.order_id INTO order_item_record FROM order_items oi WHERE oi.id = NEW.order_item_id;
  IF order_item_record.id IS NULL THEN RETURN NEW; END IF;
  SELECT id, is_draft, tenant_id INTO order_record FROM orders WHERE id = order_item_record.order_id;
  IF order_record.is_draft = true THEN RETURN NEW; END IF;
  IF NEW.extra_id IS NULL THEN RETURN NEW; END IF;
  FOR option_ingredient IN
    SELECT coi.ingredient_id, coi.quantity as recipe_quantity FROM complement_option_ingredients coi
    WHERE coi.complement_option_id = NEW.extra_id AND coi.tenant_id = order_record.tenant_id
  LOOP
    SELECT i.id, i.current_stock, i.unit INTO ingredient_record FROM ingredients i WHERE i.id = option_ingredient.ingredient_id AND i.tenant_id = order_record.tenant_id;
    IF ingredient_record.id IS NOT NULL THEN
      deduction_quantity := order_item_record.quantity * option_ingredient.recipe_quantity;
      IF ingredient_record.unit = 'kg' THEN deduction_quantity := deduction_quantity / 1000.0; END IF;
      INSERT INTO stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
      VALUES (option_ingredient.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, order_item_record.order_id, 'Baixa automática - Complemento');
      UPDATE ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = option_ingredient.ingredient_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Fix search_path on reroute_item_if_border
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
  SELECT oi.id, oi.current_station_id, oi.station_status, oi.has_edge, oi.tenant_id, oi.notes, ks.is_edge_sector
  INTO v_item FROM order_items oi LEFT JOIN kds_stations ks ON ks.id = oi.current_station_id WHERE oi.id = _item_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_item.station_status != 'waiting' OR v_item.has_edge = true THEN RETURN FALSE; END IF;
  IF v_item.is_edge_sector = true THEN RETURN FALSE; END IF;
  SELECT routing_mode, border_keywords INTO v_routing_mode, border_kws FROM kds_global_settings WHERE tenant_id = v_item.tenant_id LIMIT 1;
  IF COALESCE(v_routing_mode, 'sequential') != 'smart' THEN RETURN FALSE; END IF;
  IF border_kws IS NULL OR array_length(border_kws, 1) IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM order_item_extras WHERE order_item_id = _item_id AND kds_category = 'border') THEN
    has_border := TRUE;
  ELSIF EXISTS (SELECT 1 FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = _item_id AND sie.kds_category = 'border') THEN
    has_border := TRUE;
  ELSE
    SELECT COALESCE(string_agg(lower(extract_option_from_extra_name(oie.extra_name)), ' '), '') INTO combined_text FROM order_item_extras oie WHERE oie.order_item_id = _item_id;
    combined_text := combined_text || ' ' || COALESCE((SELECT string_agg(lower(sie.option_name), ' ') FROM order_item_sub_items si JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id WHERE si.order_item_id = _item_id), '');
    combined_text := combined_text || ' ' || lower(COALESCE(v_item.notes, ''));
    FOREACH kw IN ARRAY border_kws LOOP
      IF combined_text LIKE '%' || lower(kw) || '%' THEN has_border := TRUE; EXIT; END IF;
    END LOOP;
  END IF;
  IF NOT has_border THEN RETURN FALSE; END IF;
  SELECT id INTO edge_sector_id FROM kds_stations WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = v_item.tenant_id ORDER BY sort_order ASC LIMIT 1;
  IF edge_sector_id IS NULL THEN RETURN FALSE; END IF;
  target_sector_id := get_least_loaded_sector_online(v_item.tenant_id);
  IF target_sector_id IS NULL THEN target_sector_id := v_item.current_station_id; END IF;
  UPDATE order_items SET current_station_id = edge_sector_id, next_sector_id = target_sector_id, has_edge = true WHERE id = _item_id;
  RETURN TRUE;
END;
$function$;

-- 8. Fix overly permissive INSERT policies
DROP POLICY IF EXISTS "System can insert cardapioweb logs" ON public.cardapioweb_logs;
CREATE POLICY "Authenticated can insert cardapioweb logs"
  ON public.cardapioweb_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IS NULL OR belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "Service can insert webhook logs" ON public.order_webhook_logs;
CREATE POLICY "Authenticated can insert webhook logs"
  ON public.order_webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IS NULL OR belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "System can insert API logs" ON public.production_api_logs;
CREATE POLICY "Authenticated can insert API logs"
  ON public.production_api_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IS NULL OR belongs_to_tenant(tenant_id));