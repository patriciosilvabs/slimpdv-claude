-- Corrigir auto_initialize_new_order_item para filtrar por tenant_id
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
  order_tenant_id UUID;
BEGIN
  -- Verificar status e tenant do pedido
  SELECT is_draft, status, tenant_id INTO order_is_draft, order_current_status, order_tenant_id
  FROM orders
  WHERE id = NEW.order_id;
  
  -- Se o pedido não é rascunho e o item não tem estação, inicializar
  IF (order_is_draft = FALSE AND NEW.current_station_id IS NULL) THEN
    -- Buscar primeira estação ativa DO MESMO TENANT (menor sort_order, excluindo order_status)
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type != 'order_status'
      AND tenant_id = order_tenant_id
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

-- Corrigir auto_initialize_order_items para filtrar por tenant_id
CREATE OR REPLACE FUNCTION public.auto_initialize_order_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_station_id UUID;
BEGIN
  -- Só processa se o pedido não é rascunho e mudou para não-rascunho
  IF (NEW.is_draft = FALSE AND (OLD IS NULL OR OLD.is_draft = TRUE)) THEN
    -- Buscar primeira estação ativa DO MESMO TENANT (menor sort_order, excluindo order_status)
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type != 'order_status'
      AND tenant_id = NEW.tenant_id
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
$function$;