-- Allow all authenticated users to read profit_margin setting
CREATE POLICY "Users can view profit margin"
ON public.app_settings
FOR SELECT
USING (key = 'profit_margin');
