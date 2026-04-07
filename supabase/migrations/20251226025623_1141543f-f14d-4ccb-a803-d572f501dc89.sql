-- Remover a política ALL problemática que está bloqueando INSERT para usuários normais
DROP POLICY IF EXISTS "Platform admins can manage all tenants" ON public.tenants;

-- Criar políticas específicas para platform admins (sem INSERT, pois já existe política para isso)
CREATE POLICY "Platform admins can update tenants"
ON public.tenants
FOR UPDATE
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete tenants"
ON public.tenants
FOR DELETE
TO authenticated
USING (is_platform_admin(auth.uid()));