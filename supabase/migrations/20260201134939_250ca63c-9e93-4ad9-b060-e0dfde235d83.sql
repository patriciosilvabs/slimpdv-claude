-- ============================================
-- CORREÇÃO: Ajustar constraint e atualizar RLS
-- ============================================

-- 1. Remover constraint antiga e criar nova com tenant_id
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_tenant_unique UNIQUE (user_id, role, tenant_id);

-- 2. ATUALIZAR POLÍTICAS DE RLS PARA INCLUIR OWNERS

-- complement_groups
DROP POLICY IF EXISTS "Tenant admins can manage complement groups" ON public.complement_groups;
CREATE POLICY "Tenant admins can manage complement groups" ON public.complement_groups
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- complement_options
DROP POLICY IF EXISTS "Tenant admins can manage complement options" ON public.complement_options;
CREATE POLICY "Tenant admins can manage complement options" ON public.complement_options
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- complement_option_ingredients
DROP POLICY IF EXISTS "Tenant admins can manage complement option ingredients" ON public.complement_option_ingredients;
CREATE POLICY "Tenant admins can manage complement option ingredients" ON public.complement_option_ingredients
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- products
DROP POLICY IF EXISTS "Tenant admins can manage products" ON public.products;
CREATE POLICY "Tenant admins can manage products" ON public.products
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- categories
DROP POLICY IF EXISTS "Tenant admins can manage categories" ON public.categories;
CREATE POLICY "Tenant admins can manage categories" ON public.categories
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- product_extras
DROP POLICY IF EXISTS "Tenant admins can manage extras" ON public.product_extras;
CREATE POLICY "Tenant admins can manage extras" ON public.product_extras
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- product_variations
DROP POLICY IF EXISTS "Tenant admins can manage variations" ON public.product_variations;
CREATE POLICY "Tenant admins can manage variations" ON public.product_variations
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- ingredients
DROP POLICY IF EXISTS "Tenant admins can manage ingredients" ON public.ingredients;
CREATE POLICY "Tenant admins can manage ingredients" ON public.ingredients
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- ingredient_daily_targets
DROP POLICY IF EXISTS "Tenant admins can manage targets" ON public.ingredient_daily_targets;
CREATE POLICY "Tenant admins can manage targets" ON public.ingredient_daily_targets
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- kds_stations
DROP POLICY IF EXISTS "Tenant admins can manage KDS stations" ON public.kds_stations;
CREATE POLICY "Tenant admins can manage KDS stations" ON public.kds_stations
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- kds_global_settings
DROP POLICY IF EXISTS "Tenant admins can manage KDS global settings" ON public.kds_global_settings;
CREATE POLICY "Tenant admins can manage KDS global settings" ON public.kds_global_settings
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- print_sectors
DROP POLICY IF EXISTS "Tenant admins can manage print sectors" ON public.print_sectors;
CREATE POLICY "Tenant admins can manage print sectors" ON public.print_sectors
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- user_permissions
DROP POLICY IF EXISTS "Tenant admins can manage permissions" ON public.user_permissions;
CREATE POLICY "Tenant admins can manage permissions" ON public.user_permissions
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- cardapioweb_integrations
DROP POLICY IF EXISTS "Tenant admins can manage cardapioweb integrations" ON public.cardapioweb_integrations;
CREATE POLICY "Tenant admins can manage cardapioweb integrations" ON public.cardapioweb_integrations
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- cardapioweb_product_mappings
DROP POLICY IF EXISTS "Tenant admins can manage product mappings" ON public.cardapioweb_product_mappings;
CREATE POLICY "Tenant admins can manage product mappings" ON public.cardapioweb_product_mappings
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- custom_sounds
DROP POLICY IF EXISTS "Tenant admins can manage custom sounds" ON public.custom_sounds;
CREATE POLICY "Tenant admins can manage custom sounds" ON public.custom_sounds
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- 3. TRIGGER PARA AUTO-CRIAR ROLE ADMIN PARA OWNERS

CREATE OR REPLACE FUNCTION public.auto_create_admin_role_for_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_owner = TRUE THEN
    INSERT INTO user_roles (user_id, role, tenant_id)
    VALUES (NEW.user_id, 'admin', NEW.tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_admin_for_owner ON public.tenant_members;
CREATE TRIGGER trigger_auto_admin_for_owner
AFTER INSERT OR UPDATE ON public.tenant_members
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_admin_role_for_owner();

-- 4. BACKFILL: Criar roles admin para owners existentes
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT tm.user_id, 'admin'::app_role, tm.tenant_id
FROM tenant_members tm
WHERE tm.is_owner = TRUE
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;