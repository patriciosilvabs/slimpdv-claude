CREATE OR REPLACE FUNCTION public.process_stock_for_confirmed_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_record RECORD;
  product_ingredient RECORD;
  extra_record RECORD;
  option_ingredient RECORD;
  ingredient_record RECORD;
  deduction_quantity NUMERIC;
  found_product_recipe BOOLEAN;
BEGIN
  IF NOT (OLD.is_draft = true AND NEW.is_draft = false) THEN
    RETURN NEW;
  END IF;

  FOR item_record IN
    SELECT oi.id, oi.order_id, oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    found_product_recipe := false;

    IF item_record.product_id IS NULL THEN
      INSERT INTO public.unmapped_sales (tenant_id, order_id, order_item_id, product_name, quantity)
      VALUES (
        NEW.tenant_id,
        NEW.id,
        item_record.id,
        'Produto não identificado',
        item_record.quantity
      )
      ON CONFLICT DO NOTHING;
    ELSE
      FOR product_ingredient IN
        SELECT pi.ingredient_id, pi.quantity AS recipe_quantity
        FROM public.product_ingredients pi
        WHERE pi.product_id = item_record.product_id
          AND pi.tenant_id = NEW.tenant_id
      LOOP
        found_product_recipe := true;
        deduction_quantity := item_record.quantity * product_ingredient.recipe_quantity;

        SELECT i.id, i.current_stock
        INTO ingredient_record
        FROM public.ingredients i
        WHERE i.id = product_ingredient.ingredient_id
          AND i.tenant_id = NEW.tenant_id;

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
            NEW.tenant_id,
            NEW.id,
            'Baixa automática - Pedido finalizado'
          );

          UPDATE public.ingredients
          SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - deduction_quantity),
              updated_at = now()
          WHERE id = product_ingredient.ingredient_id;
        END IF;
      END LOOP;

      IF NOT found_product_recipe THEN
        INSERT INTO public.unmapped_sales (tenant_id, order_id, order_item_id, product_name, quantity)
        SELECT NEW.tenant_id, NEW.id, item_record.id, COALESCE(p.name, 'Produto sem nome'), item_record.quantity
        FROM public.products p
        WHERE p.id = item_record.product_id;
      END IF;
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
          AND coi.tenant_id = NEW.tenant_id
      LOOP
        deduction_quantity := item_record.quantity * option_ingredient.recipe_quantity;

        SELECT i.id, i.current_stock
        INTO ingredient_record
        FROM public.ingredients i
        WHERE i.id = option_ingredient.ingredient_id
          AND i.tenant_id = NEW.tenant_id;

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
            NEW.tenant_id,
            NEW.id,
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_process_stock_on_order_confirm ON public.orders;
CREATE TRIGGER trigger_process_stock_on_order_confirm
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (OLD.is_draft = true AND NEW.is_draft = false)
EXECUTE FUNCTION public.process_stock_for_confirmed_order();