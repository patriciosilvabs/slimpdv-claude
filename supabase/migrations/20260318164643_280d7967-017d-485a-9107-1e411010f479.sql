CREATE OR REPLACE FUNCTION public.check_order_completion(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_ready integer;
  v_order RECORD;
BEGIN
  SELECT COUNT(*) FILTER (WHERE status != 'cancelled') as total,
         COUNT(*) FILTER (WHERE station_status IN ('ready', 'dispatched', 'done') AND status != 'cancelled') as ready
  INTO v_total, v_ready
  FROM order_items
  WHERE order_id = _order_id;
  
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