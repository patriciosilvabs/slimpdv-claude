-- Add delay_threshold_minutes column for delayed orders condition
ALTER TABLE scheduled_announcements
ADD COLUMN IF NOT EXISTS delay_threshold_minutes INTEGER DEFAULT 20;