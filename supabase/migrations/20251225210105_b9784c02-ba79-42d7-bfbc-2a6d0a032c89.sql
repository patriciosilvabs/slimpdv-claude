
CREATE OR REPLACE FUNCTION public.auto_initialize_new_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_station_id UUID;
  order_is_draft BOOLEAN;
  order_current_status TEXT;
BEGIN
  -- Verificar status do pedido
  SELECT is_draft, status INTO order_is_draft, order_current_status
  FROM orders
  WHERE id = NEW.order_id;
  
  -- Se o pedido não é rascunho e o item não tem estação, inicializar
  IF (order_is_draft = FALSE AND NEW.current_station_id IS NULL) THEN
    -- Buscar primeira estação ativa (menor sort_order, excluindo order_status)
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE AND station_type != 'order_status'
    ORDER BY sort_order ASC
    LIMIT 1;
    
    IF first_station_id IS NOT NULL THEN
      NEW.current_station_id := first_station_id;
      NEW.station_status := 'waiting';
      
      -- Se pedido está 'delivered', voltar para 'preparing' para aparecer no KDS
      IF order_current_status = 'delivered' THEN
        UPDATE orders 
        SET status = 'preparing', ready_at = NULL, updated_at = now()
        WHERE id = NEW.order_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
