
CREATE OR REPLACE FUNCTION send_to_oven(_item_id uuid, _oven_minutes integer DEFAULT NULL, _user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_oven_time integer;
  v_oven_station record;
BEGIN
  -- Lock the item row
  SELECT id, current_station_id, tenant_id
  INTO v_item
  FROM order_items
  WHERE id = _item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  -- Fetch oven station (oven_expedite type)
  SELECT id, oven_time_minutes INTO v_oven_station
  FROM kds_stations
  WHERE tenant_id = v_item.tenant_id
    AND station_type = 'oven_expedite'
    AND is_active = true
  LIMIT 1;
  
  -- Use passed time, or oven station time, or default 12
  v_oven_time := COALESCE(_oven_minutes, v_oven_station.oven_time_minutes, 12);
  
  UPDATE order_items
  SET station_status = 'in_oven',
      oven_entry_at = now(),
      estimated_exit_at = now() + (v_oven_time || ' minutes')::interval,
      station_completed_at = now(),
      current_station_id = COALESCE(v_oven_station.id, current_station_id)
  WHERE id = _item_id;
  
  -- Log leaving the prep station
  INSERT INTO kds_station_logs (order_item_id, station_id, action, performed_by, tenant_id, notes)
  VALUES (_item_id, v_item.current_station_id, 'sent_to_oven', _user_id, v_item.tenant_id, v_oven_time || ' min');
  
  RETURN true;
END;
$$;
