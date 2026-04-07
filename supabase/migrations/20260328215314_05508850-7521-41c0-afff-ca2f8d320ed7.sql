
-- Add OAuth and delivery integration fields to order_webhooks
ALTER TABLE public.order_webhooks
  ADD COLUMN IF NOT EXISTS auth_url text,
  ADD COLUMN IF NOT EXISTS api_url text,
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS client_secret text,
  ADD COLUMN IF NOT EXISTS external_store_id text,
  ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false;

-- Add delivery tracking fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_delivery_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text;
