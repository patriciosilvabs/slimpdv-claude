-- Make announcements bucket public so getPublicUrl works correctly
UPDATE storage.buckets 
SET public = true 
WHERE id = 'announcements';