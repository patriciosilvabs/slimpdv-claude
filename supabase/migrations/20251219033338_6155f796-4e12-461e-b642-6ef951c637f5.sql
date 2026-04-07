-- Add ready_at column to orders table to track when order was marked as ready
ALTER TABLE public.orders ADD COLUMN ready_at timestamp with time zone;