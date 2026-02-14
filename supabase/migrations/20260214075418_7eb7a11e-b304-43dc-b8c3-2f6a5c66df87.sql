
-- Auto Service subscription plans (admin-managed)
CREATE TABLE public.auto_service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_days integer NOT NULL DEFAULT 30,
  price_credits integer NOT NULL DEFAULT 0,
  price_mmk integer NOT NULL DEFAULT 0,
  discount_percent integer NOT NULL DEFAULT 0,
  daily_video_count integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_service_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auto service plans" ON public.auto_service_plans FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active plans" ON public.auto_service_plans FOR SELECT USING (is_active = true);

-- User subscriptions
CREATE TABLE public.auto_service_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.auto_service_plans(id),
  template_category text NOT NULL DEFAULT 'motivational',
  target_language text NOT NULL DEFAULT 'Myanmar',
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  referral_code_used text,
  referred_by_user_id uuid,
  credits_paid integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_service_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.auto_service_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.auto_service_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all subscriptions" ON public.auto_service_subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Generated daily videos per user
CREATE TABLE public.auto_service_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.auto_service_subscriptions(id),
  title text NOT NULL,
  description text,
  video_url text,
  thumbnail_url text,
  template_category text NOT NULL,
  target_language text NOT NULL,
  generation_status text NOT NULL DEFAULT 'pending',
  api_used text,
  error_message text,
  credits_refunded integer DEFAULT 0,
  generated_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_service_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own videos" ON public.auto_service_videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all videos" ON public.auto_service_videos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Support tickets for auto service
CREATE TABLE public.auto_service_support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issue_type text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  ai_response text,
  is_escalated boolean DEFAULT false,
  admin_response text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_service_support ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON public.auto_service_support FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create tickets" ON public.auto_service_support FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tickets" ON public.auto_service_support FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_auto_service_plans_updated_at BEFORE UPDATE ON public.auto_service_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_auto_service_subscriptions_updated_at BEFORE UPDATE ON public.auto_service_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_auto_service_videos_updated_at BEFORE UPDATE ON public.auto_service_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_auto_service_support_updated_at BEFORE UPDATE ON public.auto_service_support FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
