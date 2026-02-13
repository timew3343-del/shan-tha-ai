
-- Fix: Remove direct user SELECT on campaigns table (which exposes admin_notes)
-- Users should use campaigns_user_view instead (which already excludes admin_notes)
DROP POLICY IF EXISTS "Users view own campaigns" ON public.campaigns;

-- Recreate the view to ensure it's security_invoker and excludes admin_notes
DROP VIEW IF EXISTS public.campaigns_user_view;
CREATE VIEW public.campaigns_user_view
WITH (security_invoker = true)
AS
SELECT 
  id, user_id, link, platform, status, 
  fb_link, tiktok_link, credits_awarded,
  created_at, updated_at
FROM public.campaigns
WHERE auth.uid() = user_id;
