
-- 1. Tabela store_api_tokens
CREATE TABLE public.store_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(tenant_id)
);

ALTER TABLE public.store_api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view store tokens"
  ON public.store_api_tokens FOR SELECT TO authenticated
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage store tokens"
  ON public.store_api_tokens FOR ALL TO authenticated
  USING (public.is_tenant_owner(tenant_id) OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.is_tenant_owner(tenant_id) OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'));

-- 2. ALTER order_webhooks - novos campos
ALTER TABLE public.order_webhooks
  ADD COLUMN IF NOT EXISTS identifier text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS failure_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz;

-- Gerar identifier para webhooks existentes
UPDATE public.order_webhooks SET identifier = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'gi'))
WHERE identifier IS NULL;

-- Garantir que não haja duplicatas antes de criar unique index
DO $$
DECLARE
  rec RECORD;
  counter int;
BEGIN
  FOR rec IN
    SELECT id, tenant_id, identifier
    FROM public.order_webhooks
    WHERE identifier IN (
      SELECT identifier FROM public.order_webhooks GROUP BY tenant_id, identifier HAVING COUNT(*) > 1
    )
  LOOP
    counter := (SELECT COUNT(*) FROM public.order_webhooks WHERE tenant_id = rec.tenant_id AND identifier = rec.identifier AND id < rec.id);
    IF counter > 0 THEN
      UPDATE public.order_webhooks SET identifier = rec.identifier || '-' || counter WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.order_webhooks ALTER COLUMN identifier SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_webhooks_tenant_identifier ON public.order_webhooks(tenant_id, identifier);

-- 3. ALTER order_webhook_logs - novos campos
ALTER TABLE public.order_webhook_logs
  ADD COLUMN IF NOT EXISTS identifier text,
  ADD COLUMN IF NOT EXISTS request_headers jsonb,
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz DEFAULT now();
