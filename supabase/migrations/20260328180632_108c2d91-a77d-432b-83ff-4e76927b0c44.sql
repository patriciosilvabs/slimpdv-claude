
-- Create webhook queue table for async processing
CREATE TABLE public.cardapioweb_webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  merchant_id text NOT NULL,
  event_type text NOT NULL,
  external_order_id text,
  order_status text,
  payload jsonb NOT NULL,
  headers jsonb,
  status text NOT NULL DEFAULT 'pending',
  retries int NOT NULL DEFAULT 0,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  lock_until timestamptz NOT NULL DEFAULT now()
);

-- Index for fast worker queries
CREATE INDEX idx_cardapioweb_webhook_queue_pending 
  ON public.cardapioweb_webhook_queue (status, lock_until) 
  WHERE status IN ('pending', 'processing');

-- Index for idempotency checks
CREATE INDEX idx_cardapioweb_webhook_queue_event 
  ON public.cardapioweb_webhook_queue (merchant_id, external_order_id, event_type);

-- RLS
ALTER TABLE public.cardapioweb_webhook_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role key)
CREATE POLICY "Service role full access on webhook queue"
  ON public.cardapioweb_webhook_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
