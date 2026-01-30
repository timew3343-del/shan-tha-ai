-- Fix security issues identified in the scan

-- 1. Add explicit DENY policies for non-admin INSERT on user_roles
CREATE POLICY "Users cannot insert their own roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- 2. Ensure credit_balance cannot be modified by users in UPDATE policy
-- Drop existing policy and create new restricted one
DROP POLICY IF EXISTS "Users can update non-credit profile fields only" ON public.profiles;

CREATE POLICY "Users can update only allowed profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  -- Note: The actual restriction is enforced by the UPDATE trigger below
);

-- 3. Create a trigger to prevent credit_balance modification by non-admins
CREATE OR REPLACE FUNCTION public.protect_credit_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If credit_balance is being changed
  IF OLD.credit_balance IS DISTINCT FROM NEW.credit_balance THEN
    -- Only allow if caller is admin (checked via RPC calls with service role)
    -- For regular users, revert the credit_balance change
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.credit_balance := OLD.credit_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_credit_balance_trigger ON public.profiles;
CREATE TRIGGER protect_credit_balance_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_credit_balance();

-- 4. Ensure transactions are immutable after creation (users cannot UPDATE)
CREATE POLICY "Users cannot update transactions"
ON public.transactions
FOR UPDATE
TO authenticated
USING (false);

-- 5. Add DELETE policy denial for user_roles by non-admins
CREATE POLICY "Users cannot delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));