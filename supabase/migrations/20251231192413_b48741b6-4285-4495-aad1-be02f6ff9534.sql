-- Adicionar coluna party_size na tabela orders
ALTER TABLE orders ADD COLUMN party_size integer;

-- Migrar dados existentes (extrair número do campo notes que contém "X pessoas")
UPDATE orders 
SET party_size = CAST(REGEXP_REPLACE(notes, '[^0-9]', '', 'g') AS integer)
WHERE notes ~ '^\d+\s*pessoas?$';

-- Limpar o campo notes dos registros migrados
UPDATE orders 
SET notes = NULL 
WHERE notes ~ '^\d+\s*pessoas?$';