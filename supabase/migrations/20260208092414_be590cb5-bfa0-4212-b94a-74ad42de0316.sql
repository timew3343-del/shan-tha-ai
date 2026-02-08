
-- Fix 1: Ensure user_feedback email is never exposed - drop user_email column data
-- We already have a data minimization policy, but let's ensure the column is always null
-- and add a trigger to enforce it at database level
CREATE OR REPLACE FUNCTION public.nullify_feedback_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_email = NULL;
  NEW.user_name = NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS enforce_feedback_email_null ON public.user_feedback;
CREATE TRIGGER enforce_feedback_email_null
  BEFORE INSERT OR UPDATE ON public.user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.nullify_feedback_email();

-- Fix 2: Add explicit deny for regular users reading promo_codes table
-- Only admins should be able to SELECT from promo_codes
DROP POLICY IF EXISTS "Only admins can view promo codes" ON public.promo_codes;
CREATE POLICY "Only admins can view promo codes"
  ON public.promo_codes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 3: Remove user ability to insert audit logs directly
-- Audit logs should only be created by server-side functions
DROP POLICY IF EXISTS "Authenticated users can insert own audit logs" ON public.credit_audit_log;

-- Fix 4: Ensure campaigns admin_notes is not visible to regular users
-- Create a restrictive policy that hides admin_notes from non-admins
-- (The existing RLS already limits to own campaigns, but admin_notes field is visible)
-- We'll handle this at the application level since Postgres can't do column-level RLS

-- Fix 5: Ensure referral_codes has proper protection
DROP POLICY IF EXISTS "Users can view own referral codes" ON public.referral_codes;
CREATE POLICY "Users can view own referral codes"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);
