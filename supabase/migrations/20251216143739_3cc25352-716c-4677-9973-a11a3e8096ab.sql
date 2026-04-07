-- Add new fields to products table for enhanced catalog management
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS internal_code text,
ADD COLUMN IF NOT EXISTS pdv_code text,
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_promotion boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS promotion_price numeric,
ADD COLUMN IF NOT EXISTS label text;