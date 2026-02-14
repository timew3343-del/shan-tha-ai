
-- Allow users to read OpenAI toggle status (public system setting)
DROP POLICY IF EXISTS "Users can view public system settings" ON public.app_settings;
CREATE POLICY "Users can view public system settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key = ANY (ARRAY['is_maintenance_mode'::text, 'stripe_enabled'::text, 'daily_free_uses'::text, 'face_swap_enabled'::text, 'api_enabled_openai'::text]));
