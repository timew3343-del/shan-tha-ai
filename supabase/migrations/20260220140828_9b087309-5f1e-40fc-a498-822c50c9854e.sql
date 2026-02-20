
-- Fix: All user SELECT policies on app_settings are RESTRICTIVE (Permissive: No)
-- This means regular users can't read ANY app_settings rows because no PERMISSIVE policy exists.
-- We need to recreate user-facing SELECT policies as PERMISSIVE.

DROP POLICY IF EXISTS "Users can view tool visibility" ON app_settings;
DROP POLICY IF EXISTS "Users can view credit costs" ON app_settings;
DROP POLICY IF EXISTS "Users can view public system settings" ON app_settings;
DROP POLICY IF EXISTS "Users can view ad and campaign settings" ON app_settings;
DROP POLICY IF EXISTS "Users can view referral settings" ON app_settings;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Users can view tool visibility" ON app_settings FOR SELECT USING (key = 'tool_visibility');
CREATE POLICY "Users can view credit costs" ON app_settings FOR SELECT USING (key ~~ 'credit_cost_%');
CREATE POLICY "Users can view public system settings" ON app_settings FOR SELECT USING (key = ANY (ARRAY['is_maintenance_mode', 'stripe_enabled', 'daily_free_uses', 'face_swap_enabled', 'api_enabled_openai', 'max_video_duration', 'daily_free_image_limit']));
CREATE POLICY "Users can view ad and campaign settings" ON app_settings FOR SELECT USING (key = ANY (ARRAY['ad_reward_amount', 'daily_ad_limit', 'ad_timer_duration', 'campaign_approval_reward', 'adsterra_script_code', 'adsterra_publisher_id', 'adsterra_ad_unit_id']));
CREATE POLICY "Users can view referral settings" ON app_settings FOR SELECT USING (key = ANY (ARRAY['referral_inviter_reward', 'referral_new_user_reward', 'referral_promo_text']));

-- Also make admin SELECT permissive
DROP POLICY IF EXISTS "Admins can view all settings" ON app_settings;
CREATE POLICY "Admins can view all settings" ON app_settings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
