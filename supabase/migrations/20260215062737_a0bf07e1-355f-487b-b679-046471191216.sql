
-- Fix daily_content_videos: Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage daily content" ON public.daily_content_videos;
DROP POLICY IF EXISTS "Anyone can view guide videos" ON public.daily_content_videos;
DROP POLICY IF EXISTS "Users can view published tutorials" ON public.daily_content_videos;

CREATE POLICY "Admins can manage daily content"
ON public.daily_content_videos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view published tutorials"
ON public.daily_content_videos FOR SELECT
USING (is_published = true AND video_type IN ('burmese_tutorial', 'english_tutorial', 'guide'));

-- Fix auto_service_videos: Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage all videos" ON public.auto_service_videos;
DROP POLICY IF EXISTS "Users can view own videos" ON public.auto_service_videos;

CREATE POLICY "Admins can manage all videos"
ON public.auto_service_videos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own videos"
ON public.auto_service_videos FOR SELECT
USING (auth.uid() = user_id);
