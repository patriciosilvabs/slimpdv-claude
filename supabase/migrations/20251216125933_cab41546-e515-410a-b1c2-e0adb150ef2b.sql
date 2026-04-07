-- Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER DEFAULT 2,
  notes TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Employees can view reservations"
ON public.reservations
FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Employees can manage reservations"
ON public.reservations
FOR ALL
USING (is_employee(auth.uid()));

-- Index for performance
CREATE INDEX idx_reservations_date ON public.reservations(reservation_date);
CREATE INDEX idx_reservations_table ON public.reservations(table_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;