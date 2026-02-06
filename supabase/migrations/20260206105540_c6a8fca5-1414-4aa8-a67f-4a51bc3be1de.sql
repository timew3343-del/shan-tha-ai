-- Allow regular authenticated users to read ad/campaign-related settings
CREATE POLICY "Users can view ad and campaign settings" 
ON public.app_settings 
FOR SELECT 
TO authenticated
USING (key IN ('ad_reward_amount', 'daily_ad_limit', 'ad_timer_duration', 'campaign_approval_reward', 'face_swap_enabled'));