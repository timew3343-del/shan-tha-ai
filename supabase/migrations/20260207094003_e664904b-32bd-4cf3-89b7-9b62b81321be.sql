
-- Create a secure redeem_promo_code function that handles entire flow server-side
-- This prevents users from bypassing promo code validation
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_user_id uuid, _code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _promo promo_codes%ROWTYPE;
  _existing_use_id uuid;
  _new_balance integer;
BEGIN
  -- Verify the caller is the user
  IF auth.uid() != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Find the promo code
  SELECT * INTO _promo
  FROM promo_codes
  WHERE code = upper(trim(_code))
    AND is_active = true;

  IF _promo.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive promo code');
  END IF;

  -- Check expiry
  IF _promo.expires_at IS NOT NULL AND _promo.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Promo code has expired');
  END IF;

  -- Check max uses
  IF _promo.max_uses IS NOT NULL AND _promo.uses_count >= _promo.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Promo code usage limit reached');
  END IF;

  -- Check if already used by this user
  SELECT id INTO _existing_use_id
  FROM promo_code_uses
  WHERE promo_code_id = _promo.id
    AND user_id = _user_id;

  IF _existing_use_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You have already used this promo code');
  END IF;

  -- Add bonus credits
  IF _promo.bonus_credits > 0 THEN
    UPDATE profiles
    SET credit_balance = credit_balance + _promo.bonus_credits,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING credit_balance INTO _new_balance;

    IF _new_balance IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'User profile not found');
    END IF;
  END IF;

  -- Record usage
  INSERT INTO promo_code_uses (promo_code_id, user_id, credits_awarded)
  VALUES (_promo.id, _user_id, _promo.bonus_credits);

  -- Update uses count
  UPDATE promo_codes
  SET uses_count = uses_count + 1
  WHERE id = _promo.id;

  -- Audit log
  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_user_id, _promo.bonus_credits, 'promo', 'Promo code: ' || upper(trim(_code)));

  RETURN json_build_object(
    'success', true,
    'bonus_credits', _promo.bonus_credits,
    'discount_percent', _promo.discount_percent,
    'new_balance', _new_balance
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(uuid, text) TO authenticated;
