
ALTER TABLE kds_global_settings ADD COLUMN IF NOT EXISTS routing_mode text NOT NULL DEFAULT 'sequential';
COMMENT ON COLUMN kds_global_settings.routing_mode IS 'sequential = all items pass through all stations; smart = detects border keywords and routes accordingly';
