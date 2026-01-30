-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  credits integer NOT NULL,
  price_mmk integer NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create referral_codes table
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  uses_count integer NOT NULL DEFAULT 0,
  credits_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create referral_uses table to track who used what code
CREATE TABLE IF NOT EXISTS public.referral_uses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  used_by_user_id uuid NOT NULL,
  credits_awarded integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(code_id, used_by_user_id)
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;

-- Subscription plans policies (anyone can view active plans)
CREATE POLICY "Anyone can view active subscription plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
ON public.subscription_plans FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Referral codes policies
CREATE POLICY "Users can view their own referral codes"
ON public.referral_codes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral codes"
ON public.referral_codes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all referral codes"
ON public.referral_codes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Referral uses policies
CREATE POLICY "Users can view their own referral uses"
ON public.referral_uses FOR SELECT
USING (auth.uid() = used_by_user_id);

CREATE POLICY "System can insert referral uses"
ON public.referral_uses FOR INSERT
WITH CHECK (auth.uid() = used_by_user_id);

CREATE POLICY "Admins can view all referral uses"
ON public.referral_uses FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add credit cost settings for new tools
INSERT INTO public.app_settings (key, value) VALUES 
  ('credit_cost_upscale', '1'),
  ('credit_cost_bg_remove', '1'),
  ('credit_cost_live_camera', '15')
ON CONFLICT (key) DO NOTHING;

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, credits, price_mmk, duration_days) VALUES
  ('Starter', 50, 5000, 30),
  ('Pro', 200, 15000, 30)
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();