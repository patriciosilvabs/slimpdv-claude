-- Add customizable column names for KDS Kanban view
ALTER TABLE kds_global_settings 
ADD COLUMN column_name_pending text NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN column_name_preparing text NOT NULL DEFAULT 'EM PREPARO',
ADD COLUMN column_name_ready text NOT NULL DEFAULT 'PRONTO';