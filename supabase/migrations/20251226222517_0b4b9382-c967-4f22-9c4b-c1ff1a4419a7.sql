-- Drop the incorrect unique constraint on just 'key'
ALTER TABLE public.global_settings DROP CONSTRAINT IF EXISTS global_settings_key_key;

-- Create the correct unique constraint on (tenant_id, key)
CREATE UNIQUE INDEX IF NOT EXISTS global_settings_tenant_key_unique ON public.global_settings (tenant_id, key);