
-- ============================================
-- KDS V2: Core SQL Functions
-- ============================================

-- 1. get_least_loaded_sector: retorna setor com menor carga
CREATE OR REPLACE FUNCTION public.get_least_loaded_sector(_tenant_id uuid, _exclude_edge boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sector_id uuid;
BEGIN
  SELECT ks.id INTO v_sector_id
  FROM kds_stations ks
  LEFT JOIN (
    SELECT current_station_id, COUNT(*) as item_count
    FROM order_items
    WHERE station_status IN ('waiting', 'in_progress')
      AND tenant_id = _tenant_id
    GROUP BY current_station_id
  ) counts ON counts.current_station_id = ks.id
  WHERE ks.tenant_id = _tenant_id
    AND ks.is_active = true
    AND ks.station_type = 'item_assembly'
    AND (NOT _exclude_edge OR ks.is_edge_sector = false)
  ORDER BY COALESCE(counts.item_count, 0) ASC, ks.sort_order ASC
  LIMIT 1;
  
  RETURN v_sector_id;
END;
$$;

-- 2. get_least_loaded_sector_with_presence: prioriza setores com operadores online
CREATE OR REPLACE FUNCTION public.get_least_loaded_sector_online(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sector_id uuid;
BEGIN
  -- Primeiro tentar setores com operadores online (last_seen < 30s)
  SELECT ks.id INTO v_sector_id
  FROM kds_stations ks
  INNER JOIN sector_presence sp ON sp.sector_id = ks.id
    AND sp.is_online = true
    AND sp.last_seen_at > now() - interval '30 seconds'
  LEFT JOIN (
    SELECT current_station_id, COUNT(*) as item_count
    FROM order_items
    WHERE station_status IN ('waiting', 'in_progress')
      AND tenant_id = _tenant_id
    GROUP BY current_station_id
  ) counts ON counts.current_station_id = ks.id
  WHERE ks.tenant_id = _tenant_id
    AND ks.is_active = true
    AND ks.station_type = 'item_assembly'
    AND ks.is_edge_sector = false
  ORDER BY COALESCE(counts.item_count, 0) ASC, ks.sort_order ASC
  LIMIT 1;
  
  -- Fallback: qualquer setor ativo
  IF v_sector_id IS NULL THEN
    v_sector_id := get_least_loaded_sector(_tenant_id, true);
  END IF;
  
  RETURN v_sector_id;
END;
$$;

-- 3. claim_order_item: operador assume um item (FOR UPDATE NOWAIT)
CREATE OR REPLACE FUNCTION public.claim_order_item(_item_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Lock row with NOWAIT - fails immediately if another transaction holds it
  SELECT id, claimed_by, station_status
  INTO v_item
  FROM order_items
  WHERE id = _item_id
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  IF v_item.claimed_by IS NOT NULL THEN
    RAISE EXCEPTION 'Item já está sendo preparado por outro operador';
  END IF;
  
  IF v_item.station_status NOT IN ('waiting', 'pending') THEN
    RAISE EXCEPTION 'Item não está disponível para claim (status: %)', v_item.station_status;
  END IF;
  
  UPDATE order_items
  SET claimed_by = _user_id,
      claimed_at = now(),
      station_status = 'in_progress',
      station_started_at = now()
  WHERE id = _item_id;
  
  RETURN true;
EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Item está sendo processado por outro operador';
END;
$$;

-- 4. complete_edge_preparation: borda pronta, mover para próximo setor
CREATE OR REPLACE FUNCTION public.complete_edge_preparation(_item_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  SELECT id, next_sector_id, has_edge, current_station_id, tenant_id
  INTO v_item
  FROM order_items
  WHERE id = _item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  IF NOT v_item.has_edge THEN
    RAISE EXCEPTION 'Item não tem borda';
  END IF;
  
  IF v_item.next_sector_id IS NULL THEN
    -- Se não tem próximo setor, buscar o menos carregado
    v_item.next_sector_id := get_least_loaded_sector_online(v_item.tenant_id);
  END IF;
  
  -- Mover para próximo setor atomicamente
  UPDATE order_items
  SET current_station_id = v_item.next_sector_id,
      next_sector_id = NULL,
      station_status = 'waiting',
      claimed_by = NULL,
      claimed_at = NULL,
      station_started_at = NULL,
      station_completed_at = now()
  WHERE id = _item_id;
  
  -- Log da ação
  INSERT INTO kds_station_logs (order_item_id, station_id, action, performed_by, tenant_id)
  VALUES (_item_id, v_item.current_station_id, 'edge_completed', _user_id, v_item.tenant_id);
  
  RETURN true;
END;
$$;

-- 5. send_to_oven: enviar item ao forno
CREATE OR REPLACE FUNCTION public.send_to_oven(_item_id uuid, _user_id uuid, _oven_minutes integer DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_oven_time integer;
BEGIN
  SELECT oi.id, oi.current_station_id, oi.tenant_id, ks.oven_time_minutes
  INTO v_item
  FROM order_items oi
  LEFT JOIN kds_stations ks ON ks.id = oi.current_station_id
  WHERE oi.id = _item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  -- Usar tempo passado ou do setor
  v_oven_time := COALESCE(_oven_minutes, v_item.oven_time_minutes, 12);
  
  UPDATE order_items
  SET station_status = 'in_oven',
      oven_entry_at = now(),
      estimated_exit_at = now() + (v_oven_time || ' minutes')::interval,
      station_completed_at = now()
  WHERE id = _item_id;
  
  -- Log
  INSERT INTO kds_station_logs (order_item_id, station_id, action, performed_by, tenant_id, notes)
  VALUES (_item_id, v_item.current_station_id, 'sent_to_oven', _user_id, v_item.tenant_id, v_oven_time || ' min');
  
  RETURN true;
END;
$$;

-- 6. mark_item_ready: marcar item como pronto (saiu do forno / finalizado)
CREATE OR REPLACE FUNCTION public.mark_item_ready(_item_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  SELECT id, order_id, tenant_id
  INTO v_item
  FROM order_items
  WHERE id = _item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  UPDATE order_items
  SET station_status = 'ready',
      ready_at = now(),
      status = 'ready'
  WHERE id = _item_id;
  
  -- Log
  INSERT INTO kds_station_logs (order_item_id, station_id, action, performed_by, tenant_id)
  VALUES (_item_id, v_item.current_station_id, 'marked_ready', _user_id, v_item.tenant_id);
  
  -- Verificar se todos os itens do pedido estão prontos
  PERFORM check_order_completion(v_item.order_id);
  
  RETURN true;
END;
$$;

-- 7. check_order_completion: verifica se pedido está completo
CREATE OR REPLACE FUNCTION public.check_order_completion(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total integer;
  v_ready integer;
  v_order RECORD;
BEGIN
  SELECT COUNT(*) FILTER (WHERE status != 'cancelled') as total,
         COUNT(*) FILTER (WHERE station_status = 'ready' AND status != 'cancelled') as ready
  INTO v_total, v_ready
  FROM order_items
  WHERE order_id = _order_id;
  
  -- Se todos prontos, atualizar pedido
  IF v_total > 0 AND v_total = v_ready THEN
    SELECT id, order_type INTO v_order FROM orders WHERE id = _order_id;
    
    IF v_order.order_type IN ('delivery', 'takeaway') THEN
      UPDATE orders SET status = 'ready', ready_at = now(), updated_at = now()
      WHERE id = _order_id AND status != 'ready';
    ELSE
      UPDATE orders SET status = 'ready', ready_at = now(), updated_at = now()
      WHERE id = _order_id AND status != 'ready';
    END IF;
  END IF;
END;
$$;

-- 8. upsert_sector_presence: heartbeat do tablet
CREATE OR REPLACE FUNCTION public.upsert_sector_presence(_sector_id uuid, _user_id uuid, _tenant_id uuid, _device_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO sector_presence (sector_id, user_id, tenant_id, device_id, is_online, last_seen_at)
  VALUES (_sector_id, _user_id, _tenant_id, _device_id, true, now())
  ON CONFLICT (sector_id, user_id)
  DO UPDATE SET is_online = true, last_seen_at = now(), device_id = COALESCE(_device_id, sector_presence.device_id);
END;
$$;

-- 9. redistribute_offline_sector_items: redistribuir itens de setores offline
CREATE OR REPLACE FUNCTION public.redistribute_offline_sector_items(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moved integer := 0;
  v_item RECORD;
  v_target_sector uuid;
BEGIN
  -- Buscar itens pending em setores sem operadores online (>30s sem heartbeat)
  FOR v_item IN
    SELECT oi.id, oi.current_station_id, ks.is_edge_sector
    FROM order_items oi
    JOIN kds_stations ks ON ks.id = oi.current_station_id
    WHERE oi.tenant_id = _tenant_id
      AND oi.station_status = 'waiting'
      AND oi.claimed_by IS NULL
      AND ks.is_edge_sector = false  -- BORDAS nunca redistribui
      AND NOT EXISTS (
        SELECT 1 FROM sector_presence sp
        WHERE sp.sector_id = oi.current_station_id
          AND sp.is_online = true
          AND sp.last_seen_at > now() - interval '30 seconds'
      )
  LOOP
    v_target_sector := get_least_loaded_sector_online(_tenant_id);
    
    IF v_target_sector IS NOT NULL AND v_target_sector != v_item.current_station_id THEN
      UPDATE order_items
      SET current_station_id = v_target_sector
      WHERE id = v_item.id;
      
      v_moved := v_moved + 1;
    END IF;
  END LOOP;
  
  RETURN v_moved;
END;
$$;
