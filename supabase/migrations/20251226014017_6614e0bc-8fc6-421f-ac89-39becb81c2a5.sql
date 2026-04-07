-- ============================================
-- FASE 1: ARQUITETURA MULTI-TENANT SaaS
-- ============================================

-- 1. Tabela de Tenants (Restaurantes)
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Dados do restaurante
  address text DEFAULT '',
  phone text DEFAULT '',
  cnpj text DEFAULT '',
  logo_url text DEFAULT '',
  
  -- Configurações centralizadas (migração do localStorage)
  settings jsonb DEFAULT '{
    "print": {
      "autoPrintKitchenTicket": true,
      "autoPrintCustomerReceipt": true,
      "duplicateKitchenTicket": false,
      "kitchenFontSize": "normal",
      "receiptFontSize": "normal",
      "lineSpacing": 0,
      "leftMargin": 0,
      "topMargin": 0,
      "bottomMarginKitchen": 3,
      "bottomMarginReceipt": 4,
      "charSpacing": 1,
      "asciiMode": false,
      "logoMaxWidth": 300,
      "logoPrintMode": "original",
      "qrCodeSize": 5,
      "showItemNumber": true,
      "showComplementPrice": false,
      "showComplementName": true,
      "largeFontProduction": false,
      "multiplyOptions": false,
      "showLogo": true,
      "printCancellation": true,
      "printRatingQr": false
    },
    "messages": {
      "standard": "Obrigado pelo seu pedido!",
      "table": "Obrigado pela preferência!",
      "qrStandard": "",
      "qrTable": ""
    },
    "order": {
      "duplicateItems": false
    },
    "tableWait": {
      "enabled": true,
      "thresholdMinutes": 20,
      "cooldownMinutes": 5
    },
    "idleTable": {
      "enabled": true,
      "thresholdMinutes": 15,
      "autoClose": false,
      "includeDeliveredOrders": false
    }
  }'::jsonb,
  
  -- Status
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabela de Planos de Assinatura
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  stripe_price_id text,
  
  -- Preços (em centavos)
  price_monthly integer NOT NULL DEFAULT 0,
  price_yearly integer,
  
  -- Limites do plano
  max_tables integer,
  max_products integer,
  max_orders_per_month integer,
  max_users integer,
  max_kds_stations integer,
  
  -- Features habilitadas
  features jsonb DEFAULT '{
    "kds": true,
    "reports": true,
    "multipleKdsStations": false,
    "api": false,
    "whiteLabel": false,
    "prioritySupport": false
  }'::jsonb,
  
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) NOT NULL,
  
  -- Status: trialing, active, past_due, canceled, expired
  status text DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  
  -- Datas importantes
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  
  -- Integração Stripe
  stripe_customer_id text,
  stripe_subscription_id text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(tenant_id)
);

-- 4. Tabela de Membros do Tenant
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'waiter',
  is_owner boolean DEFAULT false,
  
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  
  UNIQUE(tenant_id, user_id)
);

-- ============================================
-- FUNÇÕES SECURITY DEFINER
-- ============================================

-- Função para obter o tenant_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id 
  FROM public.tenant_members 
  WHERE user_id = auth.uid() 
  LIMIT 1
$$;

-- Função para verificar se usuário pertence ao tenant
CREATE OR REPLACE FUNCTION public.belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
    AND tenant_id = _tenant_id
  )
$$;

-- Função para verificar se usuário é owner do tenant
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
    AND tenant_id = _tenant_id
    AND is_owner = true
  )
$$;

-- Função para verificar se assinatura está ativa
CREATE OR REPLACE FUNCTION public.has_active_subscription(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE tenant_id = _tenant_id
    AND (
      status = 'active' 
      OR (status = 'trialing' AND trial_ends_at > now())
    )
  )
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their tenant"
  ON public.tenants FOR SELECT
  USING (public.belongs_to_tenant(id));

CREATE POLICY "Owners can update their tenant"
  ON public.tenants FOR UPDATE
  USING (public.is_tenant_owner(id));

CREATE POLICY "Anyone can create tenant during signup"
  ON public.tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Subscription Plans (público para visualização)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their subscription"
  ON public.subscriptions FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "System can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.is_tenant_owner(tenant_id));

-- Tenant Members
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their tenant members"
  ON public.tenant_members FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Owners can manage tenant members"
  ON public.tenant_members FOR ALL
  USING (public.is_tenant_owner(tenant_id) OR (auth.uid() = user_id AND is_owner = true));

CREATE POLICY "Users can join tenant"
  ON public.tenant_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para updated_at em tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para updated_at em subscriptions
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- DADOS INICIAIS - PLANOS
-- ============================================

INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, max_tables, max_products, max_orders_per_month, max_users, max_kds_stations, features, sort_order)
VALUES 
  ('Gratuito', 'Para testar o sistema', 0, 0, 5, 20, 100, 2, 1, 
   '{"kds": true, "reports": false, "multipleKdsStations": false, "api": false, "whiteLabel": false, "prioritySupport": false}'::jsonb, 1),
  
  ('Básico', 'Para pequenos estabelecimentos', 9900, 99000, 15, 100, 1000, 5, 2, 
   '{"kds": true, "reports": true, "multipleKdsStations": false, "api": false, "whiteLabel": false, "prioritySupport": false}'::jsonb, 2),
  
  ('Profissional', 'Para restaurantes em crescimento', 19900, 199000, 50, 500, 5000, 15, 5, 
   '{"kds": true, "reports": true, "multipleKdsStations": true, "api": true, "whiteLabel": false, "prioritySupport": false}'::jsonb, 3),
  
  ('Enterprise', 'Para redes e franquias', 49900, 499000, NULL, NULL, NULL, NULL, NULL, 
   '{"kds": true, "reports": true, "multipleKdsStations": true, "api": true, "whiteLabel": true, "prioritySupport": true}'::jsonb, 4)
ON CONFLICT DO NOTHING;