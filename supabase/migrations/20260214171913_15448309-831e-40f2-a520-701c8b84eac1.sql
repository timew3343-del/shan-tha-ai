
-- Logic 1: Fix Videos bucket RLS - use exact UUID matching
-- First drop any existing policies on storage.objects for videos bucket
DROP POLICY IF EXISTS "Users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from videos" ON storage.objects;

-- Create strict UUID-based policies for videos bucket
CREATE POLICY "videos_upload_own_folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "videos_read_own_folder" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "videos_delete_own_folder" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "videos_admin_full_access" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'videos' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Logic 2: Insert OpenAI balance tracking record
INSERT INTO api_balance_tracking (api_name, initial_balance, current_balance, low_balance_threshold)
VALUES ('OpenAI', 20.00, 20.00, 5.00)
ON CONFLICT DO NOTHING;
