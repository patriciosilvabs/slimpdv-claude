-- Adicionar coluna max_quantity na tabela complement_group_options
ALTER TABLE complement_group_options 
ADD COLUMN IF NOT EXISTS max_quantity integer DEFAULT 1;