
-- Add columns to support skip logging
ALTER TABLE public.order_webhook_logs
  ADD COLUMN IF NOT EXISTS dispatch_status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS skip_reason text;

-- Enable realtime for webhook logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_webhook_logs;
