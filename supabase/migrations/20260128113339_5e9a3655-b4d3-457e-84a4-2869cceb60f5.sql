-- =============================================
-- SECURITY FIX: Protect credit_balance from user manipulation
-- =============================================

-- Drop the overly permissive profile update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create restricted policy that prevents credit_balance modification
CREATE POLICY "Users can update profile info only"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  -- Ensure credit_balance hasn't changed from current value
  AND credit_balance = (SELECT credit_balance FROM profiles WHERE user_id = auth.uid())
);

-- =============================================
-- SECURITY FIX: Remove API key exposure to authenticated users
-- =============================================

-- Drop the dangerous policy that exposes API keys to all users
DROP POLICY IF EXISTS "Authenticated users can read API keys" ON public.app_settings;

-- =============================================
-- Create secure RPC function for credit deduction (server-side only)
-- =============================================

CREATE OR REPLACE FUNCTION deduct_user_credits(
  _user_id uuid,
  _amount integer,
  _action text
) RETURNS json AS $$
DECLARE
  _new_balance integer;
  _current_balance integer;
BEGIN
  -- Validate amount
  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;
  
  -- Get current balance with row lock
  SELECT credit_balance INTO _current_balance
  FROM profiles
  WHERE user_id = _user_id
  FOR UPDATE;
  
  IF _current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check sufficient balance
  IF _current_balance < _amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits', 'balance', _current_balance);
  END IF;
  
  -- Deduct credits atomically
  UPDATE profiles
  SET credit_balance = credit_balance - _amount,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING credit_balance INTO _new_balance;
  
  RETURN json_build_object(
    'success', true,
    'new_balance', _new_balance,
    'deducted', _amount,
    'action', _action
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to service role only (Edge Functions will use service role)
REVOKE ALL ON FUNCTION deduct_user_credits FROM PUBLIC;
REVOKE ALL ON FUNCTION deduct_user_credits FROM authenticated;

-- =============================================
-- Create secure RPC function for adding credits (admin/system only)
-- =============================================

CREATE OR REPLACE FUNCTION add_user_credits(
  _user_id uuid,
  _amount integer
) RETURNS json AS $$
DECLARE
  _new_balance integer;
BEGIN
  -- Validate amount
  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;
  
  -- Add credits atomically
  UPDATE profiles
  SET credit_balance = credit_balance + _amount,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING credit_balance INTO _new_balance;
  
  IF _new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'new_balance', _new_balance,
    'added', _amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Only service role can add credits
REVOKE ALL ON FUNCTION add_user_credits FROM PUBLIC;
REVOKE ALL ON FUNCTION add_user_credits FROM authenticated;