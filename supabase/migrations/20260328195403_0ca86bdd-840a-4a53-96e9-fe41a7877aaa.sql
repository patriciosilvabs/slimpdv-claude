
-- Add callback_token to order_webhooks for inbound status updates
ALTER TABLE public.order_webhooks 
ADD COLUMN IF NOT EXISTS callback_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');

-- Populate existing rows that don't have a token
UPDATE public.order_webhooks SET callback_token = encode(gen_random_bytes(24), 'hex') WHERE callback_token IS NULL;

-- Make it NOT NULL after population
ALTER TABLE public.order_webhooks ALTER COLUMN callback_token SET NOT NULL;
ALTER TABLE public.order_webhooks ALTER COLUMN callback_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_order_webhooks_callback_token ON public.order_webhooks(callback_token);
