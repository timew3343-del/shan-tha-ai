
-- Allow users to read referral reward settings
CREATE POLICY "Users can view referral settings"
ON public.app_settings
FOR SELECT
USING (key IN ('referral_inviter_reward', 'referral_new_user_reward', 'referral_promo_text'));
