
-- Fix: Grant EXECUTE permissions back to authenticated users for credit RPCs
-- but add proper authorization checks inside the functions

GRANT EXECUTE ON FUNCTION public.add_user_credits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_user_credits(uuid, integer, text) TO authenticated;

-- Recreate add_user_credits with authorization check
CREATE OR REPLACE FUNCTION public.add_user_credits(_user_id uuid, _amount integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  -- Only admins can add credits (no user should add credits to themselves via this RPC)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

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
$$;

-- Recreate deduct_user_credits with authorization check
CREATE OR REPLACE FUNCTION public.deduct_user_credits(_user_id uuid, _amount integer, _action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
  _current_balance integer;
BEGIN
  -- Users can only deduct their own credits; admins can deduct anyone's
  IF _user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deduct credits from other users');
  END IF;

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
$$;
