-- Criar tabela de fila de impressão
CREATE TABLE public.print_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  print_type TEXT NOT NULL, -- 'kitchen_ticket', 'customer_receipt', 'cancellation_ticket'
  data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'printed', 'failed'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  printed_at TIMESTAMP WITH TIME ZONE,
  printed_by_device TEXT
);

-- Enable RLS
ALTER TABLE public.print_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Employees can view print queue"
ON public.print_queue
FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Employees can insert print jobs"
ON public.print_queue
FOR INSERT
WITH CHECK (is_employee(auth.uid()));

CREATE POLICY "Employees can update print jobs"
ON public.print_queue
FOR UPDATE
USING (is_employee(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_queue;