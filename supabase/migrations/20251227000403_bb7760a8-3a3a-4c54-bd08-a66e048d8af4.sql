-- Add kanban_visible_columns to allow configuring which columns are visible in Kanban mode
ALTER TABLE public.kds_global_settings 
ADD COLUMN kanban_visible_columns TEXT[] NOT NULL DEFAULT ARRAY['pending', 'preparing', 'ready', 'delivered_today'];