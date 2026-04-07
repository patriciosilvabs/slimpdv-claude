-- Remover política antiga
DROP POLICY IF EXISTS "Cashiers can manage payments" ON public.payments;

-- Criar nova política que verifica roles OU permissões específicas
CREATE POLICY "Authorized staff can manage payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  -- Admins e caixas sempre têm acesso
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR
  -- Ou qualquer usuário com permissão específica
  has_permission(auth.uid(), 'tables_manage_payments'::permission_code) OR
  has_permission(auth.uid(), 'tables_close'::permission_code)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR
  has_permission(auth.uid(), 'tables_manage_payments'::permission_code) OR
  has_permission(auth.uid(), 'tables_close'::permission_code)
);