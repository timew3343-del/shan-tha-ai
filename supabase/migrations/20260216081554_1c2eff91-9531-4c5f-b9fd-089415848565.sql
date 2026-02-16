-- Fix duplicate referral_codes SELECT policy
DROP POLICY IF EXISTS "Users view own referral codes" ON public.referral_codes;

-- Create a secure view for daily_content_videos that excludes api_cost_credits
CREATE OR REPLACE VIEW public.public_tutorial_videos 
WITH (security_invoker = true)
AS
SELECT id, title, description, video_url, thumbnail_url, video_type, duration_seconds, 
       facebook_caption, hashtags, generated_date, is_published, created_at
FROM public.daily_content_videos
WHERE is_published = true 
  AND video_type IN ('burmese_tutorial', 'english_tutorial', 'guide');