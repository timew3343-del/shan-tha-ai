-- Allow users to read adsterra script code for ad display
DROP POLICY IF EXISTS "Users can view ad and campaign settings" ON public.app_settings;

CREATE POLICY "Users can view ad and campaign settings" 
ON public.app_settings 
FOR SELECT 
USING (key = ANY (ARRAY[
  'ad_reward_amount'::text, 
  'daily_ad_limit'::text, 
  'ad_timer_duration'::text, 
  'campaign_approval_reward'::text,
  'adsterra_script_code'::text,
  'adsterra_publisher_id'::text
]));