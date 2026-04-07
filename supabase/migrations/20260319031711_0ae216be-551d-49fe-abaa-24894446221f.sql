
-- Table for webhook configurations
CREATE TABLE public.order_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  events text[] NOT NULL DEFAULT ARRAY['order.created', 'order.ready', 'order.delivered', 'order.cancelled'],
  order_types text[] NOT NULL DEFAULT ARRAY['delivery'],
  headers jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Table for webhook delivery logs
CREATE TABLE public.order_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.order_webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  request_url text NOT NULL,
  request_body jsonb,
  response_status integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_webhooks
CREATE POLICY "Tenant admins can manage webhooks"
  ON public.order_webhooks FOR ALL TO authenticated
  USING (belongs_to_tenant(tenant_id) AND (has_tenant_role(auth.uid(), tenant_id, 'admin') OR is_tenant_owner(tenant_id)))
  WITH CHECK (belongs_to_tenant(tenant_id) AND (has_tenant_role(auth.uid(), tenant_id, 'admin') OR is_tenant_owner(tenant_id)));

CREATE POLICY "Tenant members can view webhooks"
  ON public.order_webhooks FOR SELECT TO authenticated
  USING (belongs_to_tenant(tenant_id));

-- RLS policies for order_webhook_logs
CREATE POLICY "Tenant admins can view webhook logs"
  ON public.order_webhook_logs FOR SELECT TO authenticated
  USING (belongs_to_tenant(tenant_id) AND (has_tenant_role(auth.uid(), tenant_id, 'admin') OR is_tenant_owner(tenant_id)));

CREATE POLICY "Service can insert webhook logs"
  ON public.order_webhook_logs FOR INSERT
  WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_order_webhook_logs_webhook_id ON public.order_webhook_logs(webhook_id);
CREATE INDEX idx_order_webhook_logs_created_at ON public.order_webhook_logs(created_at DESC);
CREATE INDEX idx_order_webhooks_tenant_id ON public.order_webhooks(tenant_id);
