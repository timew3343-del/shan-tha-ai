-- Allow users to read auto_ad_profit_margin setting
CREATE POLICY "Users can view auto_ad_profit_margin" 
ON public.app_settings 
FOR SELECT 
USING (key = 'auto_ad_profit_margin');
