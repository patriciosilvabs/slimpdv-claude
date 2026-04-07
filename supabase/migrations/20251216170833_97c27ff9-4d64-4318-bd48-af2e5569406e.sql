-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for fast search
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_name_search ON public.customers USING gin(to_tsvector('portuguese', name));

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Employees can manage customers
CREATE POLICY "Employees can manage customers" ON public.customers
  FOR ALL USING (is_employee(auth.uid()));

-- Employees can view customers
CREATE POLICY "Employees can view customers" ON public.customers
  FOR SELECT USING (is_employee(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();