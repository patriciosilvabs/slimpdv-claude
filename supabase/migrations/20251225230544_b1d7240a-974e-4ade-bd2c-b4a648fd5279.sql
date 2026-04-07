-- Adicionar coluna added_by em order_items para registrar quem adicionou cada item
ALTER TABLE public.order_items ADD COLUMN added_by UUID REFERENCES auth.users(id);

-- Comentário para documentação
COMMENT ON COLUMN public.order_items.added_by IS 'ID do usuário que adicionou este item ao pedido';