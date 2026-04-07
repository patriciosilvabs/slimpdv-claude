-- Add new KDS display configuration columns
ALTER TABLE kds_global_settings 
ADD COLUMN IF NOT EXISTS notes_blink_all_stations boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_waiter_name boolean NOT NULL DEFAULT true;