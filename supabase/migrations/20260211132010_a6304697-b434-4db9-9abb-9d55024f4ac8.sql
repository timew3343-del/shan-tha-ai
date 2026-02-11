
-- Allow all authenticated users to read public system settings
CREATE POLICY "Users can view public system settings"
ON public.app_settings
FOR SELECT
USING (key IN ('is_maintenance_mode', 'stripe_enabled', 'daily_free_uses', 'face_swap_enabled'));

-- Drop the old policy that mixed ad settings with face_swap_enabled
DROP POLICY IF EXISTS "Users can view ad and campaign settings" ON public.app_settings;

-- Recreate ad/campaign settings policy without face_swap_enabled (now in public settings)
CREATE POLICY "Users can view ad and campaign settings"
ON public.app_settings
FOR SELECT
USING (key IN ('ad_reward_amount', 'daily_ad_limit', 'ad_timer_duration', 'campaign_approval_reward'));
