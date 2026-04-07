-- =============================================
-- SISPRO: Fase 1B - Tabelas, Views, Funções e Triggers
-- =============================================

-- 1. Nova tabela: ingredient_daily_targets (Metas por Dia da Semana)
CREATE TABLE public.ingredient_daily_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  target_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (target_quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ingredient_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.ingredient_daily_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant members can view targets"
ON public.ingredient_daily_targets
FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage targets"
ON public.ingredient_daily_targets
FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_ingredient_daily_targets_updated_at
BEFORE UPDATE ON public.ingredient_daily_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- 2. Adicionar order_id à tabela stock_movements para rastreabilidade
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- 3. Nova tabela: unmapped_sales (Itens vendidos sem ficha técnica)
CREATE TABLE public.unmapped_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.unmapped_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant admins can view unmapped sales"
ON public.unmapped_sales
FOR SELECT
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "System can insert unmapped sales"
ON public.unmapped_sales
FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can update unmapped sales"
ON public.unmapped_sales
FOR UPDATE
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- 4. Nova tabela: production_shipments (Envios do CPD para lojas)
CREATE TABLE public.production_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  to_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  shipped_by UUID,
  shipped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  received_at TIMESTAMP WITH TIME ZONE,
  received_by UUID,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.production_shipments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view their shipments"
ON public.production_shipments
FOR SELECT
USING (belongs_to_tenant(from_tenant_id) OR belongs_to_tenant(to_tenant_id));

CREATE POLICY "Authorized users can create shipments"
ON public.production_shipments
FOR INSERT
WITH CHECK (
  belongs_to_tenant(from_tenant_id) AND 
  (has_tenant_role(auth.uid(), from_tenant_id, 'admin') OR has_permission(auth.uid(), 'production_manage'::permission_code))
);

CREATE POLICY "Authorized users can update shipments"
ON public.production_shipments
FOR UPDATE
USING (
  (belongs_to_tenant(from_tenant_id) OR belongs_to_tenant(to_tenant_id)) AND
  (has_tenant_role(auth.uid(), from_tenant_id, 'admin') OR 
   has_tenant_role(auth.uid(), to_tenant_id, 'admin') OR 
   has_permission(auth.uid(), 'production_manage'::permission_code))
)
WITH CHECK (
  (belongs_to_tenant(from_tenant_id) OR belongs_to_tenant(to_tenant_id)) AND
  (has_tenant_role(auth.uid(), from_tenant_id, 'admin') OR 
   has_tenant_role(auth.uid(), to_tenant_id, 'admin') OR 
   has_permission(auth.uid(), 'production_manage'::permission_code))
);

-- 5. Database View: v_production_demand (Demanda de Produção em Tempo Real)
CREATE OR REPLACE VIEW public.v_production_demand AS
SELECT 
  t.tenant_id,
  ten.name as store_name,
  t.ingredient_id,
  i.name as ingredient_name,
  i.unit,
  t.day_of_week,
  t.target_quantity as ideal_stock,
  COALESCE(i.current_stock, 0) as current_stock,
  GREATEST(0, t.target_quantity - COALESCE(i.current_stock, 0)) as to_produce,
  CASE 
    WHEN COALESCE(i.current_stock, 0) >= t.target_quantity THEN 'ok'
    WHEN COALESCE(i.current_stock, 0) >= t.target_quantity * 0.5 THEN 'warning'
    ELSE 'critical'
  END as status
FROM public.ingredient_daily_targets t
JOIN public.tenants ten ON ten.id = t.tenant_id
JOIN public.ingredients i ON i.id = t.ingredient_id AND i.tenant_id = t.tenant_id
WHERE t.day_of_week = EXTRACT(DOW FROM NOW())::integer;

-- 6. Função auxiliar para baixa automática de estoque
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_for_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
  product_ingredient RECORD;
  ingredient_record RECORD;
  deduction_quantity NUMERIC;
  found_ingredients BOOLEAN := false;
BEGIN
  -- Buscar informações do pedido
  SELECT id, is_draft, tenant_id INTO order_record
  FROM orders
  WHERE id = NEW.order_id;
  
  -- Só processar se o pedido NÃO for rascunho
  IF order_record.is_draft = true THEN
    RETURN NEW;
  END IF;
  
  -- Se não tem product_id, registrar como unmapped e sair
  IF NEW.product_id IS NULL THEN
    INSERT INTO unmapped_sales (tenant_id, order_id, order_item_id, product_name, quantity)
    VALUES (
      order_record.tenant_id,
      NEW.order_id,
      NEW.id,
      'Produto não identificado',
      NEW.quantity
    );
    RETURN NEW;
  END IF;
  
  -- Buscar ficha técnica do produto (product_ingredients)
  FOR product_ingredient IN
    SELECT pi.ingredient_id, pi.quantity as recipe_quantity
    FROM product_ingredients pi
    WHERE pi.product_id = NEW.product_id
      AND pi.tenant_id = order_record.tenant_id
  LOOP
    found_ingredients := true;
    -- Calcular quantidade a deduzir
    deduction_quantity := NEW.quantity * product_ingredient.recipe_quantity;
    
    -- Buscar estoque atual do ingrediente
    SELECT id, current_stock INTO ingredient_record
    FROM ingredients
    WHERE id = product_ingredient.ingredient_id
      AND tenant_id = order_record.tenant_id;
    
    IF ingredient_record.id IS NOT NULL THEN
      -- Registrar movimentação de saída
      INSERT INTO stock_movements (
        ingredient_id, 
        movement_type, 
        quantity, 
        previous_stock, 
        new_stock, 
        tenant_id, 
        order_id,
        notes
      )
      VALUES (
        product_ingredient.ingredient_id,
        'exit',
        deduction_quantity,
        COALESCE(ingredient_record.current_stock, 0),
        GREATEST(0, COALESCE(ingredient_record.current_stock, 0) - deduction_quantity),
        order_record.tenant_id,
        NEW.order_id,
        'Baixa automática - Pedido'
      );
      
      -- Atualizar estoque atual
      UPDATE ingredients
      SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - deduction_quantity),
          updated_at = now()
      WHERE id = product_ingredient.ingredient_id;
    END IF;
  END LOOP;
  
  -- Se não encontrou nenhum ingrediente na ficha técnica, registrar como unmapped
  IF NOT found_ingredients THEN
    INSERT INTO unmapped_sales (tenant_id, order_id, order_item_id, product_name, quantity)
    SELECT 
      order_record.tenant_id,
      NEW.order_id,
      NEW.id,
      COALESCE(p.name, 'Produto sem nome'),
      NEW.quantity
    FROM products p
    WHERE p.id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Função para restaurar estoque em cancelamentos
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
  movement RECORD;
BEGIN
  -- Só processar se o status mudou para 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Buscar informações do pedido
    SELECT tenant_id INTO order_record
    FROM orders
    WHERE id = NEW.order_id;
    
    -- Buscar movimentações de saída relacionadas a este item
    FOR movement IN
      SELECT sm.ingredient_id, sm.quantity, sm.id as movement_id
      FROM stock_movements sm
      WHERE sm.order_id = NEW.order_id
        AND sm.movement_type = 'exit'
        AND sm.tenant_id = order_record.tenant_id
    LOOP
      -- Registrar entrada de estorno
      INSERT INTO stock_movements (
        ingredient_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        tenant_id,
        order_id,
        notes
      )
      SELECT 
        movement.ingredient_id,
        'entry',
        movement.quantity,
        COALESCE(i.current_stock, 0),
        COALESCE(i.current_stock, 0) + movement.quantity,
        order_record.tenant_id,
        NEW.order_id,
        'Estorno - Cancelamento do pedido'
      FROM ingredients i
      WHERE i.id = movement.ingredient_id;
      
      -- Restaurar estoque
      UPDATE ingredients
      SET current_stock = COALESCE(current_stock, 0) + movement.quantity,
          updated_at = now()
      WHERE id = movement.ingredient_id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. Criar triggers
-- Trigger para baixa automática ao inserir order_item
CREATE TRIGGER auto_deduct_stock_trigger
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_deduct_stock_for_order_item();

-- Trigger para restaurar estoque em cancelamentos
CREATE TRIGGER restore_stock_on_cancel_trigger
AFTER UPDATE ON public.order_items
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
EXECUTE FUNCTION public.restore_stock_on_cancellation();

-- 9. Índices para performance
CREATE INDEX IF NOT EXISTS idx_ingredient_daily_targets_tenant_day 
ON public.ingredient_daily_targets(tenant_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_ingredient_daily_targets_ingredient 
ON public.ingredient_daily_targets(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_order 
ON public.stock_movements(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unmapped_sales_tenant_resolved 
ON public.unmapped_sales(tenant_id, resolved);

CREATE INDEX IF NOT EXISTS idx_production_shipments_tenants 
ON public.production_shipments(from_tenant_id, to_tenant_id);