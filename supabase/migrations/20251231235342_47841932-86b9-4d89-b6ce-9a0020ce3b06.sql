-- Função que limpa station_status dos itens quando o pedido é finalizado
CREATE OR REPLACE FUNCTION public.cleanup_order_items_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o pedido mudou para delivered ou cancelled
  IF (NEW.status IN ('delivered', 'cancelled') AND 
      (OLD.status IS NULL OR OLD.status NOT IN ('delivered', 'cancelled'))) THEN
    
    -- Limpar station tracking dos itens
    UPDATE order_items
    SET 
      current_station_id = NULL,
      station_status = 'done'
    WHERE order_id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que executa a função após update em orders
CREATE TRIGGER on_order_completion_cleanup
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_order_items_on_completion();

-- Limpeza retroativa: limpar order_items de pedidos já finalizados
UPDATE order_items oi
SET 
  current_station_id = NULL,
  station_status = 'done'
FROM orders o
WHERE oi.order_id = o.id
  AND o.status IN ('delivered', 'cancelled')
  AND (oi.current_station_id IS NOT NULL OR oi.station_status != 'done');