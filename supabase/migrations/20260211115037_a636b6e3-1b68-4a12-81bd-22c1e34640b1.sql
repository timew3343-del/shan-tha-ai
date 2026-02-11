
-- Make videos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'videos';

-- Add RLS policies for videos bucket
-- Authenticated users can read their own files (files prefixed with their user ID)
CREATE POLICY "Authenticated users can view own videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'videos' 
  AND auth.uid() IS NOT NULL
  AND (name LIKE concat('%', auth.uid()::text, '%'))
);

-- Service role handles uploads (edge functions use service role key)
-- No INSERT policy needed for regular users since edge functions use admin client
