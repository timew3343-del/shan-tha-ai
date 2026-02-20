
-- Allow all authenticated users to read tool_visibility setting
CREATE POLICY "Users can view tool visibility"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key = 'tool_visibility');

-- Insert default (all tools enabled)
INSERT INTO public.app_settings (key, value)
VALUES ('tool_visibility', '{}')
ON CONFLICT (key) DO NOTHING;
