
-- Fix protect_credit_balance trigger to allow SECURITY DEFINER functions
-- The issue: transfer_credits, deduct_user_credits, etc. are SECURITY DEFINER
-- but auth.uid() still reflects the caller, so the trigger blocks credit changes
-- for non-admin users even through RPCs.
-- 
-- Solution: Each SECURITY DEFINER function sets a session variable before modifying credits.
-- The trigger checks for this variable.

CREATE OR REPLACE FUNCTION public.protect_credit_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If credit_balance is being changed
  IF OLD.credit_balance IS DISTINCT FROM NEW.credit_balance THEN
    -- Allow if auth.uid() is NULL (service role / edge function context)
    -- Allow if caller is admin
    -- Allow if called from a trusted SECURITY DEFINER function (via session var)
    -- Otherwise revert the credit_balance change
    IF auth.uid() IS NOT NULL 
       AND NOT public.has_role(auth.uid(), 'admin')
       AND coalesce(current_setting('app.bypass_credit_protect', true), '') != 'true'
    THEN
      NEW.credit_balance := OLD.credit_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update transfer_credits to set bypass flag
CREATE OR REPLACE FUNCTION public.transfer_credits(_sender_id uuid, _receiver_id uuid, _amount integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sender_balance INTEGER;
  _receiver_balance INTEGER;
  _new_sender_balance INTEGER;
  _new_receiver_balance INTEGER;
  _receiver_name TEXT;
BEGIN
  -- Verify the caller is the sender
  IF auth.uid() != _sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF _sender_id = _receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer credits to yourself');
  END IF;

  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Set bypass flag for the trigger
  PERFORM set_config('app.bypass_credit_protect', 'true', true);

  SELECT credit_balance INTO _sender_balance
  FROM profiles WHERE user_id = _sender_id FOR UPDATE;

  IF _sender_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  IF _sender_balance < _amount THEN
    RETURN json_build_object('success', false, 'error', 'ခရက်ဒစ် မလုံလောက်ပါ။');
  END IF;

  SELECT credit_balance INTO _receiver_balance
  FROM profiles WHERE user_id = _receiver_id FOR UPDATE;

  IF _receiver_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Receiver not found. Please check the UUID.');
  END IF;

  SELECT COALESCE(full_name, username, 'Unknown User') INTO _receiver_name
  FROM profiles WHERE user_id = _receiver_id;

  UPDATE profiles SET credit_balance = credit_balance - _amount, updated_at = now()
  WHERE user_id = _sender_id RETURNING credit_balance INTO _new_sender_balance;

  UPDATE profiles SET credit_balance = credit_balance + _amount, updated_at = now()
  WHERE user_id = _receiver_id RETURNING credit_balance INTO _new_receiver_balance;

  INSERT INTO credit_transfers (sender_id, receiver_id, amount, sender_balance_after, receiver_balance_after)
  VALUES (_sender_id, _receiver_id, _amount, _new_sender_balance, _new_receiver_balance);

  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_sender_id, -_amount, 'transfer_out', 'Transferred to ' || _receiver_id::text);

  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_receiver_id, _amount, 'transfer_in', 'Received from ' || _sender_id::text);

  RETURN json_build_object('success', true, 'new_balance', _new_sender_balance, 'receiver_name', _receiver_name, 'amount', _amount);
END;
$function$;

-- Update deduct_user_credits to set bypass flag
CREATE OR REPLACE FUNCTION public.deduct_user_credits(_user_id uuid, _amount integer, _action text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance integer;
  _current_balance integer;
BEGIN
  IF _user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deduct credits from other users');
  END IF;

  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Set bypass flag for the trigger
  PERFORM set_config('app.bypass_credit_protect', 'true', true);

  SELECT credit_balance INTO _current_balance
  FROM profiles WHERE user_id = _user_id FOR UPDATE;

  IF _current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _current_balance < _amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits', 'balance', _current_balance);
  END IF;

  UPDATE profiles SET credit_balance = credit_balance - _amount, updated_at = now()
  WHERE user_id = _user_id RETURNING credit_balance INTO _new_balance;

  RETURN json_build_object('success', true, 'new_balance', _new_balance, 'deducted', _amount, 'action', _action);
END;
$function$;

-- Update add_user_credits to set bypass flag
CREATE OR REPLACE FUNCTION public.add_user_credits(_user_id uuid, _amount integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  PERFORM set_config('app.bypass_credit_protect', 'true', true);

  UPDATE profiles SET credit_balance = credit_balance + _amount, updated_at = now()
  WHERE user_id = _user_id RETURNING credit_balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'new_balance', _new_balance, 'added', _amount);
END;
$function$;

-- Update add_credits_via_service to set bypass flag
CREATE OR REPLACE FUNCTION public.add_credits_via_service(_user_id uuid, _amount integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance integer;
BEGIN
  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  PERFORM set_config('app.bypass_credit_protect', 'true', true);

  UPDATE profiles SET credit_balance = credit_balance + _amount, updated_at = now()
  WHERE user_id = _user_id RETURNING credit_balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'new_balance', _new_balance, 'added', _amount);
END;
$function$;

-- Update redeem_promo_code to set bypass flag
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_user_id uuid, _code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _promo promo_codes%ROWTYPE;
  _existing_use_id uuid;
  _new_balance integer;
BEGIN
  IF auth.uid() != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO _promo FROM promo_codes WHERE code = upper(trim(_code)) AND is_active = true;

  IF _promo.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive promo code');
  END IF;

  IF _promo.expires_at IS NOT NULL AND _promo.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Promo code has expired');
  END IF;

  IF _promo.max_uses IS NOT NULL AND _promo.uses_count >= _promo.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Promo code usage limit reached');
  END IF;

  SELECT id INTO _existing_use_id FROM promo_code_uses WHERE promo_code_id = _promo.id AND user_id = _user_id;

  IF _existing_use_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You have already used this promo code');
  END IF;

  PERFORM set_config('app.bypass_credit_protect', 'true', true);

  IF _promo.bonus_credits > 0 THEN
    UPDATE profiles SET credit_balance = credit_balance + _promo.bonus_credits, updated_at = now()
    WHERE user_id = _user_id RETURNING credit_balance INTO _new_balance;

    IF _new_balance IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'User profile not found');
    END IF;
  END IF;

  INSERT INTO promo_code_uses (promo_code_id, user_id, credits_awarded)
  VALUES (_promo.id, _user_id, _promo.bonus_credits);

  UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = _promo.id;

  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_user_id, _promo.bonus_credits, 'promo', 'Promo code: ' || upper(trim(_code)));

  RETURN json_build_object('success', true, 'bonus_credits', _promo.bonus_credits, 'discount_percent', _promo.discount_percent, 'new_balance', _new_balance);
END;
$function$;

-- Update purchase_tutorial to set bypass flag
CREATE OR REPLACE FUNCTION public.purchase_tutorial(_user_id uuid, _credits_cost integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_balance integer;
  _new_balance integer;
BEGIN
  IF auth.uid() != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF _credits_cost <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid cost');
  END IF;

  IF EXISTS (SELECT 1 FROM tutorial_purchases WHERE user_id = _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already purchased');
  END IF;

  PERFORM set_config('app.bypass_credit_protect', 'true', true);

  SELECT credit_balance INTO _current_balance FROM profiles WHERE user_id = _user_id FOR UPDATE;

  IF _current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF _current_balance < _credits_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  UPDATE profiles SET credit_balance = credit_balance - _credits_cost, updated_at = now()
  WHERE user_id = _user_id RETURNING credit_balance INTO _new_balance;

  INSERT INTO tutorial_purchases (user_id, credits_paid) VALUES (_user_id, _credits_cost);

  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_user_id, -_credits_cost, 'tutorial_purchase', 'Tutorial access purchased');

  RETURN json_build_object('success', true, 'new_balance', _new_balance);
END;
$function$;
