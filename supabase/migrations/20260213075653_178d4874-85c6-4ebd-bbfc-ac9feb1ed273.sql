-- Remove the policy that allows authenticated users to read API keys directly
DROP POLICY IF EXISTS "Authenticated users can read API keys" ON public.app_settings;

-- Ensure the existing admin-only and public settings policies remain
-- (They should already exist from previous migrations)