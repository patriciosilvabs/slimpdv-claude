-- Tabela para armazenar chaves de API para integração com sistemas externos (CPD)
CREATE TABLE public.production_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions JSONB NOT NULL DEFAULT '{"demand": true, "ingredients": true, "targets": true, "webhook": true}'::jsonb,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_production_api_keys_tenant ON public.production_api_keys(tenant_id);
CREATE INDEX idx_production_api_keys_api_key ON public.production_api_keys(api_key);

-- Enable RLS
ALTER TABLE public.production_api_keys ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant admins can manage API keys"
ON public.production_api_keys
FOR ALL
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role))
WITH CHECK (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Tenant members can view API keys"
ON public.production_api_keys
FOR SELECT
USING (belongs_to_tenant(tenant_id));

-- Tabela de logs de requisições da API
CREATE TABLE public.production_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.production_api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  request_body JSONB,
  response_summary TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para buscar logs por tenant
CREATE INDEX idx_production_api_logs_tenant ON public.production_api_logs(tenant_id);
CREATE INDEX idx_production_api_logs_created ON public.production_api_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.production_api_logs ENABLE ROW LEVEL SECURITY;

-- Policies para logs
CREATE POLICY "Tenant admins can view API logs"
ON public.production_api_logs
FOR SELECT
USING (belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "System can insert API logs"
ON public.production_api_logs
FOR INSERT
WITH CHECK (true);

-- Remover os triggers de baixa automática de estoque (será feito pelo CPD ou manualmente)
DROP TRIGGER IF EXISTS trigger_auto_deduct_stock_for_order_item ON public.order_items;
DROP TRIGGER IF EXISTS trigger_restore_stock_on_cancellation ON public.order_items;