-- Add indexes for fast credit and profile lookups (< 100ms target)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_user_id ON public.credit_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_created_at ON public.credit_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions (status);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings (key);
CREATE INDEX IF NOT EXISTS idx_ad_credit_logs_user_id ON public.ad_credit_logs (user_id);
