
-- Adicionar campos de configuração do modal de sabores no complement_groups
ALTER TABLE public.complement_groups
  ADD COLUMN IF NOT EXISTS flavor_modal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS flavor_modal_channels text[] NOT NULL DEFAULT ARRAY['delivery', 'counter', 'table'],
  ADD COLUMN IF NOT EXISTS flavor_options jsonb NOT NULL DEFAULT '[{"count": 1, "label": "1 Sabor", "description": "Pizza inteira de um sabor"}, {"count": 2, "label": "2 Sabores", "description": "Pizza metade/metade"}]'::jsonb;

-- Adicionar campo para pular o modal em produtos específicos
ALTER TABLE public.product_complement_groups
  ADD COLUMN IF NOT EXISTS skip_flavor_modal boolean NOT NULL DEFAULT false;
