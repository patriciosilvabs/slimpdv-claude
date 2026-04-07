-- Add columns for badge color configuration
ALTER TABLE kds_global_settings 
ADD COLUMN IF NOT EXISTS border_badge_color text NOT NULL DEFAULT 'amber',
ADD COLUMN IF NOT EXISTS notes_badge_color text NOT NULL DEFAULT 'orange';