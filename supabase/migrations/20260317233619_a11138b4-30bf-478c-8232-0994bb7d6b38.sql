
CREATE OR REPLACE FUNCTION public.send_to_oven(_item_id uuid, _user_id uuid, _oven_minutes integer DEFAULT NULL::integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_oven_time integer;
  v_station_oven_time integer;
BEGIN
  -- Lock the item row only (no outer join)
  SELECT id, current_station_id, tenant_id
  INTO v_item
  FROM order_items
  WHERE id = _item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  -- Fetch oven time from station separately (no FOR UPDATE needed)
  SELECT oven_time_minutes INTO v_station_oven_time
  FROM kds_stations
  WHERE id = v_item.current_station_id;
  
  -- Use passed time, or station time, or default 12
  v_oven_time := COALESCE(_oven_minutes, v_station_oven_time, 12);
  
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
$function$
