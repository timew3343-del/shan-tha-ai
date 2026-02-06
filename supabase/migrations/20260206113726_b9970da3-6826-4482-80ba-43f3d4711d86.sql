-- Create public videos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to videos bucket
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'videos' AND auth.uid() IS NOT NULL);

-- Allow public read access to videos bucket
CREATE POLICY "Public read access for videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'videos');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own video uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);