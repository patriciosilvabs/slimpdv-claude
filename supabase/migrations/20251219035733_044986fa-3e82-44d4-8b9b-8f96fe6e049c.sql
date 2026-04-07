-- Add delivered_at column to track when order was delivered
ALTER TABLE public.orders ADD COLUMN delivered_at timestamp with time zone;