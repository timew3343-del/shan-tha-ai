
-- Update RLS policy to include daily_free_image_limit in visible settings
DROP POLICY IF EXISTS "Users can view public system settings" ON public.app_settings;
CREATE POLICY "Users can view public system settings" ON public.app_settings
  FOR SELECT USING (
    key = ANY (ARRAY[
      'is_maintenance_mode', 'stripe_enabled', 'daily_free_uses',
      'face_swap_enabled', 'api_enabled_openai', 'max_video_duration',
      'daily_free_image_limit'
    ])
  );
