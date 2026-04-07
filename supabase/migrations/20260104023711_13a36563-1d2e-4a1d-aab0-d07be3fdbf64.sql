-- =============================================
-- CardápioWeb Integration Tables
-- =============================================

-- Tabela para configuração da integração por tenant
CREATE TABLE public.cardapioweb_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  api_token TEXT NOT NULL,
  webhook_secret TEXT,
  store_id TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Tabela para mapeamento de produtos
CREATE TABLE public.cardapioweb_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  cardapioweb_item_id INTEGER NOT NULL,
  cardapioweb_item_name TEXT NOT NULL,
  local_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  local_variation_id UUID REFERENCES public.product_variations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cardapioweb_item_id)
);

-- Tabela para logs de webhooks
CREATE TABLE public.cardapioweb_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  external_order_id TEXT,
  payload JSONB,
  status TEXT DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Adicionar colunas na tabela orders
-- =============================================

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS external_source TEXT,
ADD COLUMN IF NOT EXISTS external_order_id TEXT,
ADD COLUMN IF NOT EXISTS external_display_id TEXT,
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Índice para buscar pedidos externos
CREATE INDEX IF NOT EXISTS idx_orders_external ON public.orders(external_source, external_order_id) WHERE external_source IS NOT NULL;

-- =============================================
-- RLS Policies
-- =============================================

-- cardapioweb_integrations
ALTER TABLE public.cardapioweb_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage cardapioweb integrations"
ON public.cardapioweb_integrations FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant members can view cardapioweb integrations"
ON public.cardapioweb_integrations FOR SELECT
USING (belongs_to_tenant(tenant_id));

-- cardapioweb_product_mappings
ALTER TABLE public.cardapioweb_product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage product mappings"
ON public.cardapioweb_product_mappings FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant members can view product mappings"
ON public.cardapioweb_product_mappings FOR SELECT
USING (belongs_to_tenant(tenant_id));

-- cardapioweb_logs
ALTER TABLE public.cardapioweb_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view cardapioweb logs"
ON public.cardapioweb_logs FOR SELECT
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "System can insert cardapioweb logs"
ON public.cardapioweb_logs FOR INSERT
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_cardapioweb_integrations_updated_at
BEFORE UPDATE ON public.cardapioweb_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();