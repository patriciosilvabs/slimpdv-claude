-- Add order_management_view_mode column to kds_global_settings
ALTER TABLE public.kds_global_settings 
ADD COLUMN order_management_view_mode TEXT NOT NULL DEFAULT 'follow_kds';

-- Add comment for documentation
COMMENT ON COLUMN public.kds_global_settings.order_management_view_mode IS 'View mode for Order Management page: follow_kds, kanban, or production_line';