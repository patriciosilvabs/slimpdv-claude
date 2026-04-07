
-- Table: recipes (sub-receitas)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view recipes" ON public.recipes
  FOR SELECT TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage recipes" ON public.recipes
  FOR ALL TO authenticated
  USING (public.belongs_to_tenant(tenant_id))
  WITH CHECK (public.belongs_to_tenant(tenant_id));

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Table: recipe_ingredients
CREATE TABLE public.recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, ingredient_id)
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view recipe_ingredients" ON public.recipe_ingredients
  FOR SELECT TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage recipe_ingredients" ON public.recipe_ingredients
  FOR ALL TO authenticated
  USING (public.belongs_to_tenant(tenant_id))
  WITH CHECK (public.belongs_to_tenant(tenant_id));

-- Table: product_recipes
CREATE TABLE public.product_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  quantity_multiplier NUMERIC NOT NULL DEFAULT 1,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, recipe_id)
);

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view product_recipes" ON public.product_recipes
  FOR SELECT TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage product_recipes" ON public.product_recipes
  FOR ALL TO authenticated
  USING (public.belongs_to_tenant(tenant_id))
  WITH CHECK (public.belongs_to_tenant(tenant_id));

-- Update apply_stock_movements_for_order to include recipe deductions
CREATE OR REPLACE FUNCTION public.apply_stock_movements_for_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  recipe_record RECORD;
  recipe_ing RECORD;
BEGIN
  SELECT id, tenant_id, is_draft, status
  INTO order_record
  FROM public.orders
  WHERE id = _order_id;

  IF order_record.id IS NULL OR order_record.is_draft = true THEN
    RETURN;
  END IF;

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
          deduction_quantity := item_record.quantity * product_ingredient.recipe_quantity;
          IF ingredient_record.unit = 'kg' THEN
            deduction_quantity := deduction_quantity / 1000.0;
          END IF;

          INSERT INTO public.stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
          VALUES (product_ingredient.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, _order_id, 'Baixa automática - Pedido');

          UPDATE public.ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = product_ingredient.ingredient_id;
        END IF;
      END LOOP;

      -- 1b. Processar sub-receitas vinculadas ao produto
      FOR recipe_record IN
        SELECT pr.recipe_id, pr.quantity_multiplier
        FROM public.product_recipes pr
        WHERE pr.product_id = item_record.product_id
          AND pr.tenant_id = order_record.tenant_id
      LOOP
        FOR recipe_ing IN
          SELECT ri.ingredient_id, ri.quantity AS recipe_quantity
          FROM public.recipe_ingredients ri
          WHERE ri.recipe_id = recipe_record.recipe_id
            AND ri.tenant_id = order_record.tenant_id
        LOOP
          SELECT i.id, i.current_stock, i.unit INTO ingredient_record
          FROM public.ingredients i
          WHERE i.id = recipe_ing.ingredient_id AND i.tenant_id = order_record.tenant_id;

          IF ingredient_record.id IS NOT NULL THEN
            deduction_quantity := item_record.quantity * recipe_ing.recipe_quantity * recipe_record.quantity_multiplier;
            IF ingredient_record.unit = 'kg' THEN
              deduction_quantity := deduction_quantity / 1000.0;
            END IF;

            INSERT INTO public.stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, tenant_id, order_id, notes)
            VALUES (recipe_ing.ingredient_id, 'exit', deduction_quantity, COALESCE(ingredient_record.current_stock,0), GREATEST(0, COALESCE(ingredient_record.current_stock,0) - deduction_quantity), order_record.tenant_id, _order_id, 'Baixa automática - Sub-receita');

            UPDATE public.ingredients SET current_stock = GREATEST(0, COALESCE(current_stock,0) - deduction_quantity), updated_at = now() WHERE id = recipe_ing.ingredient_id;
          END IF;
        END LOOP;
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
$function$;
