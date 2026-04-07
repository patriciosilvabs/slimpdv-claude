
CREATE OR REPLACE FUNCTION public.mark_item_ready(_item_id uuid, _user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  SELECT id, order_id, tenant_id, current_station_id
  INTO v_item
  FROM public.order_items
  WHERE id = _item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  UPDATE public.order_items
  SET station_status = 'ready',
      ready_at = now(),
      status = 'ready'
  WHERE id = _item_id;
  
  INSERT INTO public.kds_station_logs (order_item_id, station_id, action, performed_by, tenant_id)
  VALUES (_item_id, v_item.current_station_id, 'marked_ready', _user_id, v_item.tenant_id);
  
  PERFORM public.check_order_completion(v_item.order_id);
  
  RETURN true;
END;
$$;

WITH oven_station_per_tenant AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, id AS oven_station_id
  FROM public.kds_stations
  WHERE station_type = 'oven_expedite'
    AND is_active = true
  ORDER BY tenant_id, created_at DESC, id DESC
)
UPDATE public.kds_station_logs l
SET station_id = os.oven_station_id
FROM public.order_items oi
JOIN oven_station_per_tenant os ON os.tenant_id = oi.tenant_id
WHERE l.order_item_id = oi.id
  AND l.action IN ('marked_ready', 'dispatched')
  AND oi.oven_entry_at IS NOT NULL
  AND l.station_id IS DISTINCT FROM os.oven_station_id;
