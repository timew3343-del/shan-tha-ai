-- Remove RLS policies that expose business profit margins to regular users
-- Profit margins should only be visible to admins
DROP POLICY IF EXISTS "Users can view profit margin" ON public.app_settings;
DROP POLICY IF EXISTS "Users can view auto_ad_profit_margin" ON public.app_settings;