-- Adicionar coluna served_at para rastrear quando cada item foi servido
ALTER TABLE order_items 
ADD COLUMN served_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;