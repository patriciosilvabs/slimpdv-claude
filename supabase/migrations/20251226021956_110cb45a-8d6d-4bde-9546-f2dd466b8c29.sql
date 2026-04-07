-- 1. Adicionar 'platform_admin' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';

-- 2. Criar tabela platform_admins para super admins da plataforma
CREATE TABLE public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Habilitar RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 3. Função para verificar se usuário é platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = _user_id
  )
$$;

-- 4. RLS policies para platform_admins
CREATE POLICY "Platform admins can view all platform admins"
ON public.platform_admins
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage platform admins"
ON public.platform_admins
FOR ALL
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- 5. Adicionar coluna is_active em tenants para controle
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 6. Criar trigger para proteger remoção do owner
CREATE OR REPLACE FUNCTION public.protect_tenant_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Impedir remoção de membro que é owner
  IF OLD.is_owner = true THEN
    RAISE EXCEPTION 'Não é possível remover o proprietário do tenant';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_owner_removal
BEFORE DELETE ON public.tenant_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_tenant_owner();

-- 7. Criar trigger para impedir alteração de is_owner para false
CREATE OR REPLACE FUNCTION public.protect_owner_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Impedir alteração de is_owner de true para false
  IF OLD.is_owner = true AND NEW.is_owner = false THEN
    RAISE EXCEPTION 'Não é possível remover o status de proprietário';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_owner_flag_change
BEFORE UPDATE ON public.tenant_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_owner_flag();

-- 8. Policies para platform admins visualizarem dados de todos os tenants
CREATE POLICY "Platform admins can view all tenants"
ON public.tenants
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage all tenants"
ON public.tenants
FOR ALL
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can view all subscriptions"
ON public.subscriptions
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage all subscriptions"
ON public.subscriptions
FOR ALL
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can view all tenant members"
ON public.tenant_members
FOR SELECT
USING (is_platform_admin(auth.uid()));

-- 9. Adicionar patriciobarbosadasilva@gmail.com como platform admin
INSERT INTO public.platform_admins (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'patriciobarbosadasilva@gmail.com'
ON CONFLICT DO NOTHING;