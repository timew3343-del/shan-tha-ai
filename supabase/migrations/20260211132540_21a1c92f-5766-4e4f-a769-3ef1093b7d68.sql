
-- Table to store invited collaborator emails
CREATE TABLE public.collaborator_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'trainer',
  added_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.collaborator_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can manage collaborator invites
CREATE POLICY "Admins can manage collaborator invites"
ON public.collaborator_invites
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign role on user signup if their email is in collaborator_invites
CREATE OR REPLACE FUNCTION public.handle_collaborator_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invite collaborator_invites%ROWTYPE;
BEGIN
  SELECT * INTO _invite
  FROM public.collaborator_invites
  WHERE lower(email) = lower(NEW.email);

  IF _invite.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _invite.role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger after user is created in auth.users
CREATE TRIGGER on_collaborator_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_collaborator_signup();
