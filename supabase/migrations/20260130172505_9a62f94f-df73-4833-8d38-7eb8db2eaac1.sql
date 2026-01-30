-- Fix RLS: Deny anonymous access to all sensitive tables
-- This ensures only authenticated users can access data

-- 1. Profiles - deny anon, allow only own data or admin
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Deny anon access to profiles"
ON public.profiles FOR SELECT
TO anon
USING (false);

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. User Roles - deny anon access
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Deny anon access to user_roles"
ON public.user_roles FOR SELECT
TO anon
USING (false);

CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Transactions - deny anon access
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;

CREATE POLICY "Deny anon access to transactions"
ON public.transactions FOR SELECT
TO anon
USING (false);

CREATE POLICY "Users view own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Campaigns - deny anon access
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;

CREATE POLICY "Deny anon access to campaigns"
ON public.campaigns FOR SELECT
TO anon
USING (false);

CREATE POLICY "Users view own campaigns"
ON public.campaigns FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all campaigns"
ON public.campaigns FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Referral Codes - deny anon access
DROP POLICY IF EXISTS "Users can view their own referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Admins can view all referral codes" ON public.referral_codes;

CREATE POLICY "Deny anon access to referral_codes"
ON public.referral_codes FOR SELECT
TO anon
USING (false);

CREATE POLICY "Users view own referral codes"
ON public.referral_codes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all referral codes"
ON public.referral_codes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Referral Uses - deny anon access
DROP POLICY IF EXISTS "Users can view their own referral uses" ON public.referral_uses;
DROP POLICY IF EXISTS "Admins can view all referral uses" ON public.referral_uses;

CREATE POLICY "Deny anon access to referral_uses"
ON public.referral_uses FOR SELECT
TO anon
USING (false);

CREATE POLICY "Users view own referral uses"
ON public.referral_uses FOR SELECT
TO authenticated
USING (auth.uid() = used_by_user_id);

CREATE POLICY "Admins view all referral uses"
ON public.referral_uses FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));