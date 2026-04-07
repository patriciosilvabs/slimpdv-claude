
CREATE OR REPLACE FUNCTION public.mark_item_ready(_item_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
BEGIN
  SELECT id, order_id, tenant_id, current_station_id
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
$function$;
