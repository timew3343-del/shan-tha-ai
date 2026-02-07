
-- ============================================
-- Daily Content Factory: stores auto-generated videos
-- ============================================
CREATE TABLE public.daily_content_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_type TEXT NOT NULL DEFAULT 'marketing',
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  facebook_caption TEXT,
  hashtags TEXT[],
  duration_seconds INTEGER DEFAULT 60,
  api_cost_credits NUMERIC(10,2) DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  generated_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_content_videos ENABLE ROW LEVEL SECURITY;

-- Admins can manage all content
CREATE POLICY "Admins can manage daily content"
ON public.daily_content_videos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Published tutorials visible to all authenticated users
CREATE POLICY "Users can view published tutorials"
ON public.daily_content_videos FOR SELECT
USING (is_published = true AND video_type IN ('burmese_tutorial', 'english_tutorial'));

-- Guide videos visible to everyone (including unauthenticated)
CREATE POLICY "Anyone can view guide videos"
ON public.daily_content_videos FOR SELECT
USING (is_published = true AND video_type = 'guide');

-- Trigger for updated_at
CREATE TRIGGER update_daily_content_videos_updated_at
BEFORE UPDATE ON public.daily_content_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_content_videos;

-- ============================================
-- Tutorial Purchases: lifetime access tracking
-- ============================================
CREATE TABLE public.tutorial_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credits_paid INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tutorial purchases"
ON public.tutorial_purchases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tutorial purchases"
ON public.tutorial_purchases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tutorial purchases"
ON public.tutorial_purchases FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
