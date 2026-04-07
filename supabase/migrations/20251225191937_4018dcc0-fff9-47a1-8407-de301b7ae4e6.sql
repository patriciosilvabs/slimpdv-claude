-- Add compact mode setting for KDS
ALTER TABLE kds_global_settings 
ADD COLUMN compact_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN kds_global_settings.compact_mode IS 
'Modo compacto - mostra mais pedidos por tela em alta demanda';