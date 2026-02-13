-- Allow users to read adsterra_ad_unit_id from app_settings
DROP POLICY IF EXISTS "Users can view ad and campaign settings" ON public.app_settings;
CREATE POLICY "Users can view ad and campaign settings"
ON public.app_settings
FOR SELECT
USING (key = ANY (ARRAY[
  'ad_reward_amount',
  'daily_ad_limit',
  'ad_timer_duration',
  'campaign_approval_reward',
  'adsterra_script_code',
  'adsterra_publisher_id',
  'adsterra_ad_unit_id'
]));