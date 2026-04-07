-- Criar função que inicializa novos itens de pedido para o KDS
CREATE OR REPLACE FUNCTION public.auto_initialize_new_order_item()
RETURNS TRIGGER AS $$
DECLARE
  first_station_id UUID;
  order_is_draft BOOLEAN;
BEGIN
  -- Verificar se o pedido não é rascunho
  SELECT is_draft INTO order_is_draft
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para novos itens de pedido
CREATE TRIGGER trg_auto_init_new_order_item
BEFORE INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_initialize_new_order_item();

-- Adicionar colunas de configuração do timer na tabela kds_global_settings
ALTER TABLE public.kds_global_settings 
ADD COLUMN IF NOT EXISTS timer_green_minutes integer NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS timer_yellow_minutes integer NOT NULL DEFAULT 10;

-- Adicionar coluna para habilitar alerta de atraso
ALTER TABLE public.kds_global_settings 
ADD COLUMN IF NOT EXISTS delay_alert_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS delay_alert_minutes integer NOT NULL DEFAULT 10;