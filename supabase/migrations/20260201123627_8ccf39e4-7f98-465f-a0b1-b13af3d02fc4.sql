-- Tabela para vincular ingredientes às opções de complemento (ficha técnica)
CREATE TABLE public.complement_option_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complement_option_id UUID NOT NULL REFERENCES public.complement_options(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(complement_option_id, ingredient_id, tenant_id)
);

-- Índices para performance
CREATE INDEX idx_complement_option_ingredients_option ON public.complement_option_ingredients(complement_option_id);
CREATE INDEX idx_complement_option_ingredients_ingredient ON public.complement_option_ingredients(ingredient_id);
CREATE INDEX idx_complement_option_ingredients_tenant ON public.complement_option_ingredients(tenant_id);

-- Habilitar RLS
ALTER TABLE public.complement_option_ingredients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Tenant admins can manage complement option ingredients"
  ON public.complement_option_ingredients
  FOR ALL
  USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant members can view complement option ingredients"
  ON public.complement_option_ingredients
  FOR SELECT
  USING (belongs_to_tenant(tenant_id));

-- Função trigger para baixa automática de estoque para extras/complementos
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_for_extras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_record RECORD;
  order_item_record RECORD;
  option_ingredient RECORD;
  ingredient_record RECORD;
  deduction_quantity NUMERIC;
BEGIN
  -- Buscar informações do order_item
  SELECT oi.id, oi.quantity, oi.order_id
  INTO order_item_record
  FROM order_items oi
  WHERE oi.id = NEW.order_item_id;
  
  IF order_item_record.id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar informações do pedido
  SELECT id, is_draft, tenant_id INTO order_record
  FROM orders
  WHERE id = order_item_record.order_id;
  
  -- Só processar se o pedido NÃO for rascunho
  IF order_record.is_draft = true THEN
    RETURN NEW;
  END IF;
  
  -- Se não tem extra_id (opção de complemento), sair
  IF NEW.extra_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar ingredientes da opção de complemento
  FOR option_ingredient IN
    SELECT coi.ingredient_id, coi.quantity as recipe_quantity
    FROM complement_option_ingredients coi
    WHERE coi.complement_option_id = NEW.extra_id
      AND coi.tenant_id = order_record.tenant_id
  LOOP
    -- Calcular quantidade a deduzir (quantidade do item * quantidade da receita)
    deduction_quantity := order_item_record.quantity * option_ingredient.recipe_quantity;
    
    -- Buscar estoque atual do ingrediente
    SELECT id, current_stock INTO ingredient_record
    FROM ingredients
    WHERE id = option_ingredient.ingredient_id
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
        option_ingredient.ingredient_id,
        'exit',
        deduction_quantity,
        COALESCE(ingredient_record.current_stock, 0),
        GREATEST(0, COALESCE(ingredient_record.current_stock, 0) - deduction_quantity),
        order_record.tenant_id,
        order_item_record.order_id,
        'Baixa automática - Complemento'
      );
      
      -- Atualizar estoque atual
      UPDATE ingredients
      SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - deduction_quantity),
          updated_at = now()
      WHERE id = option_ingredient.ingredient_id;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger para baixa automática ao inserir extras
CREATE TRIGGER trigger_auto_deduct_stock_for_extras
  AFTER INSERT ON public.order_item_extras
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deduct_stock_for_extras();