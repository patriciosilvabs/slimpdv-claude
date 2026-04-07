
ALTER TABLE public.kds_devices 
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS auth_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kds_devices_verification_code 
  ON public.kds_devices (verification_code) 
  WHERE verification_code IS NOT NULL;
