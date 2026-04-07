ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS integracao_logistica_status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS integracao_logistica_log text;