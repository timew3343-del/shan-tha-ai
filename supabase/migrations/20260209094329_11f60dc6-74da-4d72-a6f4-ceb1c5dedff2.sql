
-- Create credit_transfers table for P2P transfers
CREATE TABLE public.credit_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  sender_balance_after INTEGER NOT NULL,
  receiver_balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_transfers ENABLE ROW LEVEL SECURITY;

-- Users can view their own transfers (sent or received)
CREATE POLICY "Users can view own transfers"
ON public.credit_transfers
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Admins can view all transfers
CREATE POLICY "Admins can view all transfers"
ON public.credit_transfers
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- System insert via RPC only (no direct inserts)
CREATE POLICY "No direct inserts"
ON public.credit_transfers
FOR INSERT
WITH CHECK (false);

-- Create secure RPC for P2P credit transfer
CREATE OR REPLACE FUNCTION public.transfer_credits(
  _sender_id UUID,
  _receiver_id UUID,
  _amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Cannot transfer to yourself
  IF _sender_id = _receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer credits to yourself');
  END IF;

  -- Validate amount
  IF _amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock sender's row and check balance
  SELECT credit_balance INTO _sender_balance
  FROM profiles
  WHERE user_id = _sender_id
  FOR UPDATE;

  IF _sender_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  IF _sender_balance < _amount THEN
    RETURN json_build_object('success', false, 'error', 'ခရက်ဒစ် မလုံလောက်ပါ။');
  END IF;

  -- Lock receiver's row and check existence
  SELECT credit_balance INTO _receiver_balance
  FROM profiles
  WHERE user_id = _receiver_id
  FOR UPDATE;

  IF _receiver_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Receiver not found. Please check the UUID.');
  END IF;

  -- Get receiver name for confirmation
  SELECT COALESCE(full_name, username, 'Unknown User') INTO _receiver_name
  FROM profiles
  WHERE user_id = _receiver_id;

  -- Deduct from sender
  UPDATE profiles
  SET credit_balance = credit_balance - _amount, updated_at = now()
  WHERE user_id = _sender_id
  RETURNING credit_balance INTO _new_sender_balance;

  -- Add to receiver
  UPDATE profiles
  SET credit_balance = credit_balance + _amount, updated_at = now()
  WHERE user_id = _receiver_id
  RETURNING credit_balance INTO _new_receiver_balance;

  -- Record the transfer
  INSERT INTO credit_transfers (sender_id, receiver_id, amount, sender_balance_after, receiver_balance_after)
  VALUES (_sender_id, _receiver_id, _amount, _new_sender_balance, _new_receiver_balance);

  -- Audit logs for both parties
  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_sender_id, -_amount, 'transfer_out', 'Transferred to ' || _receiver_id::text);

  INSERT INTO credit_audit_log (user_id, amount, credit_type, description)
  VALUES (_receiver_id, _amount, 'transfer_in', 'Received from ' || _sender_id::text);

  RETURN json_build_object(
    'success', true,
    'new_balance', _new_sender_balance,
    'receiver_name', _receiver_name,
    'amount', _amount
  );
END;
$$;
