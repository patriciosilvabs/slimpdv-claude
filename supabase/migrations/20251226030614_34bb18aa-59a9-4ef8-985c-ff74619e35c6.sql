-- Adicionar política SELECT para permitir que o owner veja seu próprio tenant
-- Isso resolve o problema do SELECT após INSERT falhar porque o usuário ainda não está em tenant_members
CREATE POLICY "Owner can view own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());