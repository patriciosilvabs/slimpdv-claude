DROP TRIGGER IF EXISTS auto_deduct_stock_trigger ON public.order_items;
DROP TRIGGER IF EXISTS trigger_auto_deduct_stock_for_extras ON public.order_item_extras;
DROP TRIGGER IF EXISTS restore_stock_on_cancel_trigger ON public.order_items;

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
BEGIN
  SELECT id, tenant_id, is_draft, status
  INTO order_record
  FROM public.orders
  WHERE id = _order_id;

  IF order_record.id IS NULL OR order_record.is_draft = true THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements sm
    WHERE sm.order_id = _order_id
  ) THEN
    RETURN;
  END IF;

  FOR item_record IN
    SELECT oi.id, oi.order_id, oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
  LOOP
    IF item_record.product_id IS NOT NULL THEN
      FOR product_ingredient IN
        SELECT pi.ingredient_id, pi.quantity AS recipe_quantity
        FROM public.product_ingredients pi
        WHERE pi.product_id = item_record.product_id
          AND pi.tenant_id = order_record.tenant_id
      LOOP
        deduction_quantity := item_record.quantity * product_ingredient.recipe_quantity;

        SELECT i.id, i.current_stock
        INTO ingredient_record
        FROM public.ingredients i
        WHERE i.id = product_ingredient.ingredient_id
          AND i.tenant_id = order_record.tenant_id;

        IF ingredient_record.id IS NOT NULL THEN
          INSERT INTO public.stock_movements (
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
            _order_id,
            'Baixa automática - Pedido finalizado'
          );

          UPDATE public.ingredients
          SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - deduction_quantity),
              updated_at = now()
          WHERE id = product_ingredient.ingredient_id;
        END IF;
      END LOOP;
    END IF;

    FOR extra_record IN
      SELECT oie.extra_id
      FROM public.order_item_extras oie
      WHERE oie.order_item_id = item_record.id
        AND oie.extra_id IS NOT NULL
    LOOP
      FOR option_ingredient IN
        SELECT coi.ingredient_id, coi.quantity AS recipe_quantity
        FROM public.complement_option_ingredients coi
        WHERE coi.complement_option_id = extra_record.extra_id
          AND coi.tenant_id = order_record.tenant_id
      LOOP
        deduction_quantity := item_record.quantity * option_ingredient.recipe_quantity;

        SELECT i.id, i.current_stock
        INTO ingredient_record
        FROM public.ingredients i
        WHERE i.id = option_ingredient.ingredient_id
          AND i.tenant_id = order_record.tenant_id;

        IF ingredient_record.id IS NOT NULL THEN
          INSERT INTO public.stock_movements (
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
            _order_id,
            'Baixa automática - Complemento finalizado'
          );

          UPDATE public.ingredients
          SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - deduction_quantity),
              updated_at = now()
          WHERE id = option_ingredient.ingredient_id;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_stock_for_confirmed_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_draft = true AND NEW.is_draft = false THEN
    PERFORM public.apply_stock_movements_for_order(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_process_stock_on_order_confirm ON public.orders;
CREATE TRIGGER trigger_process_stock_on_order_confirm
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (OLD.is_draft = true AND NEW.is_draft = false)
EXECUTE FUNCTION public.process_stock_for_confirmed_order();

DO $$
DECLARE
  order_row RECORD;
BEGIN
  FOR order_row IN
    SELECT o.id
    FROM public.orders o
    WHERE o.is_draft = false
      AND o.created_at >= now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1
        FROM public.stock_movements sm
        WHERE sm.order_id = o.id
      )
  LOOP
    PERFORM public.apply_stock_movements_for_order(order_row.id);
  END LOOP;
END;
$$;