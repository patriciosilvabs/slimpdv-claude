-- Create bucket for restaurant logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('restaurant-logos', 'restaurant-logos', true);

-- Policy for public read access
CREATE POLICY "Public can read logos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'restaurant-logos');

-- Policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload logos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');

-- Policy for authenticated users to update their logos
CREATE POLICY "Authenticated users can update logos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');

-- Policy for authenticated users to delete logos
CREATE POLICY "Authenticated users can delete logos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');