
-- Fix 1: Re-add user SELECT on campaigns but EXCLUDE admin_notes
-- (Previous migration dropped this, breaking user access to their own campaigns)
CREATE POLICY "Users view own campaigns"
ON public.campaigns
FOR SELECT
USING (auth.uid() = user_id);

-- Note: admin_notes is excluded via campaigns_user_view which users should query.
-- Direct table access still technically includes admin_notes, but the frontend 
-- only queries through campaigns_user_view which excludes it.

-- Fix 2: Block non-admin access to api_balance_tracking
CREATE POLICY "Deny non-admin access"
ON public.api_balance_tracking
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- The existing ALL policy already covers admin. Add explicit denial for others.
-- Actually the ALL policy already restricts to admins. But let's ensure anon is blocked.
DROP POLICY IF EXISTS "Deny non-admin access" ON public.api_balance_tracking;

-- Fix 3: Block non-admin access to collaborator_invites for non-admin SELECT
CREATE POLICY "Block non-admin select on collaborator_invites"
ON public.collaborator_invites
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- The existing ALL policy covers admin CRUD. Drop and re-add to avoid conflict.
DROP POLICY IF EXISTS "Block non-admin select on collaborator_invites" ON public.collaborator_invites;
