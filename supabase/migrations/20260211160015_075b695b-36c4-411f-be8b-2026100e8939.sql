-- Create a service-level function for adding credits (used by edge functions with service role)
CREATE OR REPLACE FUNCTION public.add_credits_via_service(_user_id uuid, _amount integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_balance integer;
BEGIN
  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  UPDATE profiles
  SET credit_balance = credit_balance + _amount,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING credit_balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'new_balance', _new_balance, 'added', _amount);
END;
$$;