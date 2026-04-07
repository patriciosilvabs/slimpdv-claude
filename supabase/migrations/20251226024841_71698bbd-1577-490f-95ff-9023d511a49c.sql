-- Corrigir política INSERT em user_roles para permitir onboarding
-- Permitir que owner do tenant adicione admin role a si mesmo
DROP POLICY IF EXISTS "Owner can add admin role to self" ON public.user_roles;
CREATE POLICY "Owner can add admin role to self"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND is_tenant_owner(tenant_id)
  AND role = 'admin'::app_role
);

-- Recriar política INSERT para tenants com maior clareza
DROP POLICY IF EXISTS "Anyone can create tenant during signup" ON public.tenants;
CREATE POLICY "Authenticated users can create tenant"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);