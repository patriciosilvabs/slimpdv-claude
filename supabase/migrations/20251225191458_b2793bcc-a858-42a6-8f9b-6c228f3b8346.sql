-- Adicionar coluna show_party_size à tabela kds_global_settings
ALTER TABLE kds_global_settings 
ADD COLUMN show_party_size boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN kds_global_settings.show_party_size IS 
'Mostrar quantidade de pessoas (X pessoas) no KDS';