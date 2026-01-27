-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for admin management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add credit_balance column to profiles
ALTER TABLE public.profiles ADD COLUMN credit_balance INTEGER NOT NULL DEFAULT 10;

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount_mmk INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    package_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    screenshot_url TEXT,
    is_first_purchase BOOLEAN DEFAULT false,
    bonus_credits INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin by email
CREATE OR REPLACE FUNCTION public.is_admin_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _email IN ('timew3343@gmail.com', 'youtrubezarni@gmail.com')
$$;

-- Create function to get user email from auth.users
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _user_id
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for transactions
CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all transactions"
ON public.transactions FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-assign admin role and 1500 credits for admin emails
CREATE OR REPLACE FUNCTION public.handle_admin_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the new user's email is an admin email
  IF NEW.email IN ('timew3343@gmail.com', 'youtrubezarni@gmail.com') THEN
    -- Update their credit balance to 1500
    UPDATE public.profiles SET credit_balance = 1500 WHERE user_id = NEW.id;
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for admin signup
CREATE TRIGGER on_admin_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_admin_signup();

-- Trigger for transactions timestamp
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();