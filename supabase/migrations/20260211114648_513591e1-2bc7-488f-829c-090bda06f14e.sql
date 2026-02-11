
-- Fix campaigns_user_view to use security_invoker
DROP VIEW IF EXISTS public.campaigns_user_view;

CREATE VIEW public.campaigns_user_view
WITH (security_invoker = true)
AS
SELECT id, user_id, link, platform, status, created_at, updated_at, credits_awarded, fb_link, tiktok_link
FROM public.campaigns;
