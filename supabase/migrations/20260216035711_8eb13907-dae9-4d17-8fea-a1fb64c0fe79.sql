
-- Store admin emails in app_settings for dynamic management
INSERT INTO app_settings (key, value) VALUES ('admin_emails', '["timew3343@gmail.com", "youtrubezarni@gmail.com"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Update is_admin_email to read from app_settings dynamically
CREATE OR REPLACE FUNCTION public.is_admin_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emails jsonb;
BEGIN
  SELECT value::jsonb INTO _emails FROM app_settings WHERE key = 'admin_emails';
  IF _emails IS NULL THEN RETURN FALSE; END IF;
  RETURN _emails ? _email;
END;
$$;

-- Update handle_admin_signup to use is_admin_email function
CREATE OR REPLACE FUNCTION public.handle_admin_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_email(NEW.email) THEN
    UPDATE public.profiles SET credit_balance = 2500 WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
