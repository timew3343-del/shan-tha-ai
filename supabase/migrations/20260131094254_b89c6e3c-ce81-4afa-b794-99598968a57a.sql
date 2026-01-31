-- Enable realtime for app_settings table
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Insert default system settings if they don't exist
INSERT INTO public.app_settings (key, value) 
VALUES 
  ('is_maintenance_mode', 'false'),
  ('replicate_api_token', ''),
  ('stripe_publishable_key', ''),
  ('stripe_secret_key', '')
ON CONFLICT (key) DO NOTHING;