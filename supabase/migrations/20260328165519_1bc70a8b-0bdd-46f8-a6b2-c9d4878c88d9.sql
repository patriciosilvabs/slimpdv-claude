-- Drop both overloaded versions
DROP FUNCTION IF EXISTS public.send_to_oven(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.send_to_oven(uuid, uuid, integer);

-- Recreate single version
CREATE OR REPLACE FUNCTION public.send_to_oven(
  _item_id uuid,
  _user_id uuid DEFAULT NULL,
  _oven_minutes integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_oven_time integer;
  v_oven_station record;
BEGIN
  SELECT id, current_station_id, tenant_id
  INTO v_item
  FROM order_items
  WHERE id = _item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  SELECT id, oven_time_minutes INTO v_oven_station
  FROM kds_stations
  WHERE tenant_id = v_item.tenant_id
    AND station_type = 'oven_expedite'
    AND is_active = true
  LIMIT 1;

  v_oven_time := COALESCE(_oven_minutes, v_oven_station.oven_time_minutes, 12);

  UPDATE order_items
  SET station_status = 'in_oven',
      oven_entry_at = now(),
      estimated_exit_at = now() + (v_oven_time || ' minutes')::interval,
      station_completed_at = now(),
      current_station_id = COALESCE(v_oven_station.id, current_station_id)
  WHERE id = _item_id;

  INSERT INTO kds_station_logs (order_item_id, station_id, action, performed_by, tenant_id, notes)
  VALUES (_item_id, v_item.current_station_id, 'sent_to_oven', _user_id, v_item.tenant_id, v_oven_time || ' min');

  RETURN true;
END;
$function$;