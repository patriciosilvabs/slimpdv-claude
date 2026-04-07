-- Função para inicializar automaticamente itens na primeira estação
CREATE OR REPLACE FUNCTION auto_initialize_order_items()
RETURNS TRIGGER AS $$
DECLARE
  first_station_id UUID;
BEGIN
  -- Só processa se o pedido não é rascunho e mudou para não-rascunho
  IF (NEW.is_draft = FALSE AND (OLD IS NULL OR OLD.is_draft = TRUE)) THEN
    -- Buscar primeira estação ativa (menor sort_order, excluindo order_status)
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE AND station_type != 'order_status'
    ORDER BY sort_order ASC
    LIMIT 1;
    
    IF first_station_id IS NOT NULL THEN
      -- Atualizar todos os itens do pedido
      UPDATE order_items
      SET current_station_id = first_station_id,
          station_status = 'waiting'
      WHERE order_id = NEW.id;
      
      -- Atualizar status do pedido para preparing
      NEW.status := 'preparing';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para executar na inserção/atualização de pedidos
CREATE TRIGGER tr_auto_initialize_order_items
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION auto_initialize_order_items();