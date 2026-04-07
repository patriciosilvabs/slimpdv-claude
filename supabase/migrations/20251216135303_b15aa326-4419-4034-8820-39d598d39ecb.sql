-- Adicionar campo description em product_extras
ALTER TABLE public.product_extras ADD COLUMN IF NOT EXISTS description text;

-- Adicionar campo description em product_variations
ALTER TABLE public.product_variations ADD COLUMN IF NOT EXISTS description text;

-- Criar tabela de vinculação produto-extra (N:N)
CREATE TABLE IF NOT EXISTS public.product_extra_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  extra_id uuid NOT NULL REFERENCES public.product_extras(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, extra_id)
);

-- Habilitar RLS
ALTER TABLE public.product_extra_links ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage extra links"
  ON public.product_extra_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view extra links"
  ON public.product_extra_links FOR SELECT
  USING (is_employee(auth.uid()));