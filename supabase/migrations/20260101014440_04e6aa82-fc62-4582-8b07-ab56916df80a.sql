-- Add cancellation fields to order_items table
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL;