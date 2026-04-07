-- Add new fields for demand-based triggers
ALTER TABLE public.scheduled_announcements
ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS condition_type TEXT,
ADD COLUMN IF NOT EXISTS condition_threshold INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS condition_comparison TEXT DEFAULT 'greater_than',
ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER DEFAULT 30;

-- Add comment for documentation
COMMENT ON COLUMN public.scheduled_announcements.trigger_type IS 'scheduled or condition';
COMMENT ON COLUMN public.scheduled_announcements.condition_type IS 'orders_in_production, orders_pending, orders_total_active';
COMMENT ON COLUMN public.scheduled_announcements.condition_threshold IS 'Number threshold for condition';
COMMENT ON COLUMN public.scheduled_announcements.condition_comparison IS 'greater_than, less_than, equals';
COMMENT ON COLUMN public.scheduled_announcements.cooldown_minutes IS 'Minimum minutes between condition triggers';