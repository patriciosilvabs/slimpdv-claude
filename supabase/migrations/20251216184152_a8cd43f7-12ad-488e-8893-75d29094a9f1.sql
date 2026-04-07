-- Create custom_sounds table for personalized notification sounds
CREATE TABLE public.custom_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sound_type TEXT NOT NULL CHECK (sound_type IN ('newOrder', 'newReservation', 'orderReady', 'kdsNewOrder')),
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_sounds ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_sounds
CREATE POLICY "Employees can view all custom sounds"
ON public.custom_sounds FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Employees can create custom sounds"
ON public.custom_sounds FOR INSERT
WITH CHECK (is_employee(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Admins can manage all custom sounds"
ON public.custom_sounds FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create scheduled_announcements table
CREATE TABLE public.scheduled_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly')),
  scheduled_time TIME NOT NULL,
  scheduled_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
  scheduled_date DATE,
  is_active BOOLEAN DEFAULT true,
  target_screens TEXT[] DEFAULT '{kds}',
  volume DECIMAL(3,2) DEFAULT 1.0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_played_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.scheduled_announcements ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_announcements
CREATE POLICY "Employees can view scheduled announcements"
ON public.scheduled_announcements FOR SELECT
USING (is_employee(auth.uid()));

CREATE POLICY "Admins can manage scheduled announcements"
ON public.scheduled_announcements FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('notification-sounds', 'notification-sounds', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('announcements', 'announcements', true);

-- Storage policies for notification-sounds bucket
CREATE POLICY "Anyone can view notification sounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'notification-sounds');

CREATE POLICY "Employees can upload notification sounds"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'notification-sounds' AND is_employee(auth.uid()));

CREATE POLICY "Admins can delete notification sounds"
ON storage.objects FOR DELETE
USING (bucket_id = 'notification-sounds' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for announcements bucket
CREATE POLICY "Anyone can view announcements"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcements');

CREATE POLICY "Admins can upload announcements"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'announcements' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete announcements"
ON storage.objects FOR DELETE
USING (bucket_id = 'announcements' AND has_role(auth.uid(), 'admin'::app_role));