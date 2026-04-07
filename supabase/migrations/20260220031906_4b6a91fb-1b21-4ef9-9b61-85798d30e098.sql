
-- Adicionar kds_category na tabela complement_groups
ALTER TABLE public.complement_groups ADD COLUMN kds_category text NOT NULL DEFAULT 'complement';

-- Adicionar kds_category na tabela order_item_extras
ALTER TABLE public.order_item_extras ADD COLUMN kds_category text NOT NULL DEFAULT 'complement';

-- Adicionar kds_category na tabela order_item_sub_item_extras
ALTER TABLE public.order_item_sub_item_extras ADD COLUMN kds_category text NOT NULL DEFAULT 'complement';
