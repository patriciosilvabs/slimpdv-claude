-- Limpar movimentações erradas (valores em g quando deviam ser kg)
DELETE FROM public.stock_movements;

-- Restaurar estoque dos ingredientes ao valor original
UPDATE public.ingredients SET current_stock = 100, updated_at = now() WHERE name = 'FARINHA DE TRIGO';
UPDATE public.ingredients SET current_stock = 100, updated_at = now() WHERE name = 'CALABRESA';

-- Recriar a função principal com:
-- 1. Conversão g→kg (ficha técnica em g, ingrediente em kg)
-- 2. Processamento de sub_item_extras (sabores de pizza)
CREATE OR REPLACE FUNCTION public.apply_stock_movements_for_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_record RECORD;
  item_record RECORD;
  product_ingredient RECORD;
  extra_record RECORD;
  option_ingredient RECORD;
  ingredient_record RECORD;
  deduction_quantity NUMERIC;
  ingredient_unit TEXT;
  sub_extra_record RECORD;
  sub_item_record RECORD;
  flavor_count INTEGER;
BEGIN
  SELECT id, tenant_id, is_draft, status
  INTO order_record
  FROM public.orders
  WHERE id = _order_id;

  IF order_record.id IS NULL OR order_record.is_draft = true THEN
    RETURN;
  END IF;

  -- Evitar duplicação
  IF EXISTS (
    SELECT 1 FROM public.stock_movements sm WHERE sm.order_id = _order_id
  ) THEN
    RETURN;
  END IF;

  FOR item_record IN
    SELECT oi.id, oi.order_id, oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
  LOOP
    -- 1. Processar ficha técnica do produto
    IF item_record.product_id IS NOT NULL THEN
      FOR product_ingredient IN
        SELECT pi.ingredient_id, pi.quantity AS recipe_quantity
        FROM public.product_ingredients pi
        WHERE pi.product_id = item_record.product_id
          AND pi.tenant_id = order_record.tenant_id
      LOOP
        SELECT i.id, i.current_stock, i.unit INTO ingredient_record
        FROM public.ingredients i
        WHERE i.id = product_ingredient.ingredient_id AND i.tenant_id = order_record.tenant_id;

        IF ingredient_record.id IS NOT NULL THEN
          -- Receita em g, ingrediente em kg → dividir por 1000
          deduction_quantity := item_record.quantity * product_ingredient.recipe_quantity;
          IF ingredient_record.unit = 'kg' THEN
            deduction_quantity := deduction_quantity / 1000.0;
          END IF;

          INSERT INTO public.stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
          VALUES (product_ingredient.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, _order_id, 'Baixa automática - Pedido');

          UPDATE public.ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = product_ingredient.ingredient_id;
        END IF;
      END LOOP;
    END IF;

    -- 2. Processar extras diretos (order_item_extras)
    FOR extra_record IN
      SELECT oie.extra_id FROM public.order_item_extras oie
      WHERE oie.order_item_id = item_record.id AND oie.extra_id IS NOT NULL
    LOOP
      FOR option_ingredient IN
        SELECT coi.ingredient_id, coi.quantity AS recipe_quantity
        FROM public.complement_option_ingredients coi
        WHERE coi.complement_option_id = extra_record.extra_id AND coi.tenant_id = order_record.tenant_id
      LOOP
        SELECT i.id, i.current_stock, i.unit INTO ingredient_record
        FROM public.ingredients i
        WHERE i.id = option_ingredient.ingredient_id AND i.tenant_id = order_record.tenant_id;

        IF ingredient_record.id IS NOT NULL THEN
          deduction_quantity := item_record.quantity * option_ingredient.recipe_quantity;
          IF ingredient_record.unit = 'kg' THEN
            deduction_quantity := deduction_quantity / 1000.0;
          END IF;

          INSERT INTO public.stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
          VALUES (option_ingredient.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, _order_id, 'Baixa automática - Complemento');

          UPDATE public.ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = option_ingredient.ingredient_id;
        END IF;
      END LOOP;
    END LOOP;

    -- 3. Processar sub_item_extras (SABORES de pizza)
    -- Contar quantos sabores tem este item
    SELECT COUNT(*) INTO flavor_count
    FROM public.order_item_sub_items si
    WHERE si.order_item_id = item_record.id;

    IF flavor_count < 1 THEN
      flavor_count := 1;
    END IF;

    FOR sub_extra_record IN
      SELECT sie.option_id
      FROM public.order_item_sub_items si
      JOIN public.order_item_sub_item_extras sie ON sie.sub_item_id = si.id
      WHERE si.order_item_id = item_record.id
        AND sie.option_id IS NOT NULL
    LOOP
      FOR option_ingredient IN
        SELECT coi.ingredient_id, coi.quantity AS recipe_quantity
        FROM public.complement_option_ingredients coi
        WHERE coi.complement_option_id = sub_extra_record.option_id AND coi.tenant_id = order_record.tenant_id
      LOOP
        SELECT i.id, i.current_stock, i.unit INTO ingredient_record
        FROM public.ingredients i
        WHERE i.id = option_ingredient.ingredient_id AND i.tenant_id = order_record.tenant_id;

        IF ingredient_record.id IS NOT NULL THEN
          -- Ficha técnica = pizza inteira em g. Dividir por nº de sabores.
          deduction_quantity := item_record.quantity * (option_ingredient.recipe_quantity / flavor_count);
          IF ingredient_record.unit = 'kg' THEN
            deduction_quantity := deduction_quantity / 1000.0;
          END IF;

          INSERT INTO public.stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
          VALUES (option_ingredient.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, _order_id, 'Baixa automática - Sabor');

          UPDATE public.ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = option_ingredient.ingredient_id;
        END IF;
      END LOOP;
    END LOOP;

  END LOOP;
END;
$$;

-- Atualizar também os triggers existentes de INSERT (para pedidos não-draft)
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
  SELECT oi.id, oi.quantity, oi.order_id INTO order_item_record
  FROM order_items oi WHERE oi.id = NEW.order_item_id;
  IF order_item_record.id IS NULL THEN RETURN NEW; END IF;

  SELECT id, is_draft, tenant_id INTO order_record FROM orders WHERE id = order_item_record.order_id;
  IF order_record.is_draft = true THEN RETURN NEW; END IF;
  IF NEW.extra_id IS NULL THEN RETURN NEW; END IF;

  FOR option_ingredient IN
    SELECT coi.ingredient_id, coi.quantity as recipe_quantity
    FROM complement_option_ingredients coi
    WHERE coi.complement_option_id = NEW.extra_id AND coi.tenant_id = order_record.tenant_id
  LOOP
    SELECT i.id, i.current_stock, i.unit INTO ingredient_record
    FROM ingredients i WHERE i.id = option_ingredient.ingredient_id AND i.tenant_id = order_record.tenant_id;

    IF ingredient_record.id IS NOT NULL THEN
      deduction_quantity := order_item_record.quantity * option_ingredient.recipe_quantity;
      IF ingredient_record.unit = 'kg' THEN deduction_quantity := deduction_quantity / 1000.0; END IF;

      INSERT INTO stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
      VALUES (option_ingredient.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, order_item_record.order_id, 'Baixa automática - Complemento');

      UPDATE ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = option_ingredient.ingredient_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Atualizar trigger de order_items para converter g→kg também
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_for_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_record RECORD;
  product_ingredient RECORD;
  ingredient_record RECORD;
  deduction_quantity NUMERIC;
  found_ingredients BOOLEAN := false;
BEGIN
  SELECT id, is_draft, tenant_id INTO order_record FROM orders WHERE id = NEW.order_id;
  IF order_record.is_draft = true THEN RETURN NEW; END IF;

  IF NEW.product_id IS NULL THEN
    INSERT INTO unmapped_sales (tenant_id, order_id, order_item_id, product_name, quantity)
    VALUES (order_record.tenant_id, NEW.order_id, NEW.id, 'Produto não identificado', NEW.quantity);
    RETURN NEW;
  END IF;

  FOR product_ingredient IN
    SELECT pi.ingredient_id, pi.quantity as recipe_quantity
    FROM product_ingredients pi
    WHERE pi.product_id = NEW.product_id AND pi.tenant_id = order_record.tenant_id
  LOOP
    found_ingredients := true;
    SELECT i.id, i.current_stock, i.unit INTO ingredient_record
    FROM ingredients i WHERE i.id = product_ingredient.ingredient_id AND i.tenant_id = order_record.tenant_id;

    IF ingredient_record.id IS NOT NULL THEN
      deduction_quantity := NEW.quantity * product_ingredient.recipe_quantity;
      IF ingredient_record.unit = 'kg' THEN deduction_quantity := deduction_quantity / 1000.0; END IF;

      INSERT INTO stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
      VALUES (product_ingredient.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, NEW.order_id, 'Baixa automática - Pedido');

      UPDATE ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = product_ingredient.ingredient_id;
    END IF;
  END LOOP;

  IF NOT found_ingredients THEN
    INSERT INTO unmapped_sales (tenant_id, order_id, order_item_id, product_name, quantity)
    SELECT order_record.tenant_id, NEW.order_id, NEW.id, COALESCE(p.name, 'Produto sem nome'), NEW.quantity
    FROM products p WHERE p.id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Reprocessar pedidos dos últimos 7 dias
DO $$
DECLARE
  order_row RECORD;
BEGIN
  FOR order_row IN
    SELECT o.id FROM public.orders o
    WHERE o.is_draft = false AND o.status != 'cancelled'
      AND o.created_at >= now() - interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM public.stock_movements sm WHERE sm.order_id = o.id)
  LOOP
    PERFORM public.apply_stock_movements_for_order(order_row.id);
  END LOOP;
END;
$$;