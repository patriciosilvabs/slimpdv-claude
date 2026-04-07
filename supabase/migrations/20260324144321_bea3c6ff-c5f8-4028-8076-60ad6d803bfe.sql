
-- Add birthday to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add customer_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Index for faster customer lookups on orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
