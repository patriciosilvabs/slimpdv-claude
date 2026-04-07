
-- ============================================
-- KDS V2: Atualizar triggers de distribuição
-- ============================================

-- Substituir assign_station_on_order_confirm para usar o novo modelo
CREATE OR REPLACE FUNCTION public.assign_station_on_order_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  edge_sector_id UUID;
  target_sector_id UUID;
  item_record RECORD;
  has_border BOOLEAN;
  border_kws TEXT[] := ARRAY['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'];
  kds_settings RECORD;
  kw TEXT;
  combined_text TEXT;
BEGIN
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN
    
    -- Carregar keywords de borda das configurações
    SELECT border_keywords INTO kds_settings
    FROM kds_global_settings
    WHERE tenant_id = NEW.tenant_id
    LIMIT 1;
    
    IF kds_settings.border_keywords IS NOT NULL AND array_length(kds_settings.border_keywords, 1) > 0 THEN
      border_kws := kds_settings.border_keywords;
    END IF;
    
    -- Buscar setor de BORDAS (is_edge_sector = true)
    SELECT id INTO edge_sector_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND is_edge_sector = true
      AND tenant_id = NEW.tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;
    
    -- Processar cada item individualmente
    FOR item_record IN 
      SELECT oi.id, oi.notes,
             COALESCE(
               (SELECT string_agg(lower(oie.extra_name), ' ')
                FROM order_item_extras oie 
                WHERE oie.order_item_id = oi.id),
               ''
             ) as extras_text,
             COALESCE(
               (SELECT string_agg(lower(sie.option_name), ' ')
                FROM order_item_sub_items si
                JOIN order_item_sub_item_extras sie ON sie.sub_item_id = si.id
                WHERE si.order_item_id = oi.id AND sie.kds_category = 'border'),
               ''
             ) as border_extras_text
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.current_station_id IS NULL
        AND (oi.station_status IS NULL OR oi.station_status = 'waiting')
    LOOP
      -- Detectar borda
      has_border := FALSE;
      combined_text := lower(COALESCE(item_record.notes, '') || ' ' || item_record.extras_text || ' ' || item_record.border_extras_text);
      
      FOREACH kw IN ARRAY border_kws LOOP
        IF combined_text LIKE '%' || lower(kw) || '%' THEN
          has_border := TRUE;
          EXIT;
        END IF;
      END LOOP;
      
      -- Buscar setor de produção (load balance)
      target_sector_id := get_least_loaded_sector_online(NEW.tenant_id);
      
      -- Fallback se não encontrar nenhum setor
      IF target_sector_id IS NULL THEN
        target_sector_id := edge_sector_id;
      END IF;
      
      IF has_border AND edge_sector_id IS NOT NULL THEN
        -- Item com borda → BORDAS primeiro, next_sector = produção
        UPDATE order_items
        SET current_station_id = edge_sector_id,
            next_sector_id = target_sector_id,
            has_edge = true,
            station_status = 'waiting'
        WHERE id = item_record.id;
      ELSE
        -- Item sem borda → direto para produção
        UPDATE order_items
        SET current_station_id = target_sector_id,
            has_edge = false,
            station_status = 'waiting'
        WHERE id = item_record.id;
      END IF;
    END LOOP;
    
    NEW.status := 'preparing';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar auto_initialize_new_order_item para usar o novo modelo
CREATE OR REPLACE FUNCTION public.auto_initialize_new_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  edge_sector_id UUID;
  target_sector_id UUID;
  order_is_draft BOOLEAN;
  order_current_status TEXT;
  order_tenant_id UUID;
  has_border BOOLEAN;
  border_kws TEXT[] := ARRAY['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'];
  kds_settings RECORD;
  kw TEXT;
  combined_text TEXT;
BEGIN
  SELECT is_draft, status, tenant_id INTO order_is_draft, order_current_status, order_tenant_id
  FROM orders
  WHERE id = NEW.order_id;
  
  IF (order_is_draft = FALSE AND NEW.current_station_id IS NULL) THEN
    
    -- Carregar keywords
    SELECT border_keywords INTO kds_settings
    FROM kds_global_settings
    WHERE tenant_id = order_tenant_id
    LIMIT 1;
    
    IF kds_settings.border_keywords IS NOT NULL AND array_length(kds_settings.border_keywords, 1) > 0 THEN
      border_kws := kds_settings.border_keywords;
    END IF;
    
    -- Buscar setor de BORDAS
    SELECT id INTO edge_sector_id
    FROM kds_stations
    WHERE is_active = TRUE AND is_edge_sector = true AND tenant_id = order_tenant_id
    ORDER BY sort_order ASC LIMIT 1;
    
    -- Detectar borda nas notas do item
    combined_text := lower(COALESCE(NEW.notes, ''));
    has_border := FALSE;
    FOREACH kw IN ARRAY border_kws LOOP
      IF combined_text LIKE '%' || lower(kw) || '%' THEN
        has_border := TRUE;
        EXIT;
      END IF;
    END LOOP;
    
    -- Load balance para setor de produção
    target_sector_id := get_least_loaded_sector_online(order_tenant_id);
    IF target_sector_id IS NULL THEN
      target_sector_id := edge_sector_id;
    END IF;
    
    IF has_border AND edge_sector_id IS NOT NULL THEN
      NEW.current_station_id := edge_sector_id;
      NEW.next_sector_id := target_sector_id;
      NEW.has_edge := true;
      NEW.station_status := 'waiting';
    ELSE
      NEW.current_station_id := target_sector_id;
      NEW.has_edge := false;
      NEW.station_status := 'waiting';
    END IF;
    
    -- Reabrir pedidos entregues quando novos itens são adicionados
    IF order_current_status = 'delivered' THEN
      UPDATE orders 
      SET status = 'preparing', ready_at = NULL, updated_at = now()
      WHERE id = NEW.order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
