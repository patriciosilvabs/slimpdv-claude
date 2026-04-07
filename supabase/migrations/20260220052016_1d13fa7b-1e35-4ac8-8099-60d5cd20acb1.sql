
-- Add authentication fields to kds_devices
ALTER TABLE public.kds_devices 
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS password_hash text;

-- Add unique constraint for username per tenant
CREATE UNIQUE INDEX IF NOT EXISTS kds_devices_username_tenant_unique 
  ON public.kds_devices (username, tenant_id);
