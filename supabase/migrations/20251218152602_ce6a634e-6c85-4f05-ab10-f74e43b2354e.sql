-- Make notification-sounds and announcements buckets private
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('notification-sounds', 'announcements');

-- Remove public SELECT policies
DROP POLICY IF EXISTS "Anyone can view notification sounds" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view announcements" ON storage.objects;

-- Add employee-only SELECT policies for notification-sounds
CREATE POLICY "Employees can view notification sounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'notification-sounds' AND is_employee(auth.uid()));

-- Add employee-only SELECT policies for announcements
CREATE POLICY "Employees can view announcements"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcements' AND is_employee(auth.uid()));