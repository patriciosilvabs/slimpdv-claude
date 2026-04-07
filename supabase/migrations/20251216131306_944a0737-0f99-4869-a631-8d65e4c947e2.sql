-- Função para verificar se pode fazer bootstrap do primeiro admin
CREATE OR REPLACE FUNCTION public.can_bootstrap_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
$$;

-- Política que permite criar o primeiro admin (quando não existe nenhum)
CREATE POLICY "First user can become admin" ON public.user_roles 
FOR INSERT TO authenticated 
WITH CHECK (
  role = 'admin' 
  AND auth.uid() = user_id 
  AND public.can_bootstrap_admin(auth.uid())
);