-- Fix 1: Prevent direct tutorial_purchases inserts - use RPC instead
DROP POLICY IF EXISTS "Users can insert own tutorial purchases" ON public.tutorial_purchases;

CREATE POLICY "No direct tutorial inserts"
ON public.tutorial_purchases FOR INSERT
WITH CHECK (false);

-- Create secure RPC for tutorial purchase with credit deduction
CREATE OR REPLACE FUNCTION public.purchase_tutorial(_user_id uuid, _credits_cost integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance integer;
  _new_balance integer;
BEGIN
  -- Verify caller is the user
  IF auth.uid() != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate cost
  IF _credits_cost <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid cost');
  END IF;

  -- Check if already purchased
  IF EXISTS (SELECT 1 FROM tutorial_purchases WHERE user_id = _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already purchased');
  END IF;

  -- Get and lock balance
  SELECT credit_balance INTO _current_balance
  FROM profiles WHERE user_id = _user_id FOR UPDATE;

  IF _current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF _current_balance < _credits_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Deduct credits
  UPDATE profiles
  SET credit_balance = credit_balance - _credits_cost, updated_at = now()
  WHERE user_id = _user_id
  RETURNING credit_balance INTO _new_balance;

  -- Record purchase
  INSERT INTO tutorial_purchases (user_id, credits_paid)
  VALUES (_user_id, _credits_cost);

  -- Audit log
  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_user_id, -_credits_cost, 'tutorial_purchase', 'Tutorial access purchased');

  RETURN json_build_object('success', true, 'new_balance', _new_balance);
END;
$$;

-- Fix 2: Create view to hide admin_notes from regular users
CREATE OR REPLACE VIEW public.campaigns_user_view AS
SELECT id, user_id, link, platform, status, created_at, updated_at, credits_awarded, fb_link, tiktok_link
FROM public.campaigns;
