-- Allow authenticated users to read API keys from app_settings (needed for the app to work)
CREATE POLICY "Authenticated users can read API keys"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key IN ('gemini_api_key', 'stability_api_key'));