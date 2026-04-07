
-- 1. Add missing columns to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS adults_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_observation_field boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_for text[] NOT NULL DEFAULT ARRAY['delivery','counter','table']::text[],
  ADD COLUMN IF NOT EXISTS allowed_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promotional_price_schedules jsonb DEFAULT NULL;

-- 2. Add allowed_times to categories
ALTER TABLE public.categories 
  ADD COLUMN IF NOT EXISTS allowed_times jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Add badge to complement_group_options
ALTER TABLE public.complement_group_options 
  ADD COLUMN IF NOT EXISTS badge text DEFAULT NULL;
