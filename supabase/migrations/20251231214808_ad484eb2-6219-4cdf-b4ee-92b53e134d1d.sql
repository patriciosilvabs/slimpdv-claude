-- Adicionar coluna served_at para marcar quando o pedido foi servido
-- sem mudar o status do pedido (que continua ativo para cliente pedir mais ou fechar conta)
ALTER TABLE public.orders ADD COLUMN served_at TIMESTAMP WITH TIME ZONE;