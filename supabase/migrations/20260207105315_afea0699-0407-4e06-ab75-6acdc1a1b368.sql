-- Remove the overly permissive promo codes policy that lets any user browse all active codes
-- Users should only validate codes through the redeem_promo_code RPC (SECURITY DEFINER)
DROP POLICY IF EXISTS "Users can view active promo codes" ON public.promo_codes;