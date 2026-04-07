-- Create order_reopens table for audit trail
CREATE TABLE public.order_reopens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reopened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  order_type TEXT,
  customer_name TEXT,
  total_value NUMERIC
);

-- Enable RLS
ALTER TABLE public.order_reopens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Employees can view order reopens"
  ON public.order_reopens
  FOR SELECT
  USING (is_employee(auth.uid()));

CREATE POLICY "Employees can create order reopens"
  ON public.order_reopens
  FOR INSERT
  WITH CHECK (is_employee(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_order_reopens_reopened_at ON public.order_reopens(reopened_at DESC);