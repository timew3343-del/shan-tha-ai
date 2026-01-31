-- Add fb_link and tiktok_link columns to campaigns table (replacing single link column)
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS fb_link text,
ADD COLUMN IF NOT EXISTS tiktok_link text;

-- Migrate existing link data to fb_link for backwards compatibility
UPDATE public.campaigns SET fb_link = link WHERE link IS NOT NULL AND fb_link IS NULL;

-- Create ad_credit_logs table to track ad-based credit earnings with daily limits
CREATE TABLE public.ad_credit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  credits_earned integer NOT NULL DEFAULT 5,
  source text NOT NULL DEFAULT 'adsterra',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create credit_audit_log table to track free vs purchased credits for admin monitoring
CREATE TABLE public.credit_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  credit_type text NOT NULL CHECK (credit_type IN ('purchased', 'ad_reward', 'campaign_reward', 'referral', 'admin_manual')),
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.ad_credit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for ad_credit_logs
CREATE POLICY "Users view own ad credit logs" ON public.ad_credit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all ad credit logs" ON public.ad_credit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert ad credit logs" ON public.ad_credit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for credit_audit_log
CREATE POLICY "Admins view all credit audit logs" ON public.credit_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert credit audit logs" ON public.credit_audit_log
  FOR INSERT WITH CHECK (true);

-- Enable realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_credit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_audit_log;