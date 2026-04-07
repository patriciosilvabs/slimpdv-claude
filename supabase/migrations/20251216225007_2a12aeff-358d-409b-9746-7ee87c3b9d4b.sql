-- Table to track table switches for audit purposes
CREATE TABLE public.table_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  to_table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  switched_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  switched_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text
);

-- Enable RLS
ALTER TABLE public.table_switches ENABLE ROW LEVEL SECURITY;

-- Policies for table_switches
CREATE POLICY "Employees can view table switches"
ON public.table_switches
FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Employees can create table switches"
ON public.table_switches
FOR INSERT
WITH CHECK (is_employee(auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_table_switches_order_id ON public.table_switches(order_id);
CREATE INDEX idx_table_switches_switched_at ON public.table_switches(switched_at DESC);