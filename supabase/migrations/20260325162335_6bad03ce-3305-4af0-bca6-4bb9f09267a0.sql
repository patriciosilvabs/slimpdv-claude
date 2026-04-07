
-- 1. Add columns to recipes table
ALTER TABLE public.recipes 
  ADD COLUMN IF NOT EXISTS output_ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_yield NUMERIC DEFAULT 0;

-- 2. Add ingredient_type to ingredients table
ALTER TABLE public.ingredients 
  ADD COLUMN IF NOT EXISTS ingredient_type TEXT NOT NULL DEFAULT 'standard';

-- 3. Create production_orders table
CREATE TABLE public.production_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  produced_by UUID,
  quantity_produced NUMERIC NOT NULL DEFAULT 0,
  expected_quantity NUMERIC NOT NULL DEFAULT 0,
  loss_quantity NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  batch_label TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. RLS for production_orders
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view production orders"
  ON public.production_orders FOR SELECT
  TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can insert production orders"
  ON public.production_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can update production orders"
  ON public.production_orders FOR UPDATE
  TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can delete production orders"
  ON public.production_orders FOR DELETE
  TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

-- 5. Enable realtime for production_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_orders;
