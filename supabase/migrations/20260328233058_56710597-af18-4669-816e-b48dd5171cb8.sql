
CREATE TABLE public.delivery_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.order_webhooks(id) ON DELETE CASCADE,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view retry queue"
  ON public.delivery_retry_queue FOR SELECT TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members can insert retry queue"
  ON public.delivery_retry_queue FOR INSERT TO authenticated
  WITH CHECK (public.belongs_to_tenant(tenant_id));
