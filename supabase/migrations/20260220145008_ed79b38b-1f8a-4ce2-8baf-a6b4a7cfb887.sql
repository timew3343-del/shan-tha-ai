-- Fix protect_credit_balance trigger to allow service role (edge functions) to deduct credits
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
    -- Otherwise revert the credit_balance change
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.credit_balance := OLD.credit_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;