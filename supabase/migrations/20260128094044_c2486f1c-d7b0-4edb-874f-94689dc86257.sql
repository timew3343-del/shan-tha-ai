-- Update the admin signup handler to grant 2500 credits instead of 1500
CREATE OR REPLACE FUNCTION public.handle_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the new user's email is an admin email
  IF NEW.email IN ('timew3343@gmail.com', 'youtrubezarni@gmail.com') THEN
    -- Update their credit balance to 2500
    UPDATE public.profiles SET credit_balance = 2500 WHERE user_id = NEW.id;
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Also update is_admin_email function to be consistent
CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _email IN ('timew3343@gmail.com', 'youtrubezarni@gmail.com')
$$;