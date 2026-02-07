-- Create promo_codes table for discount code system
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL DEFAULT 10,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create promo_code_uses table to track redemptions
CREATE TABLE public.promo_code_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Promo codes: admins full access, users can view active codes
CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active promo codes"
ON public.promo_codes FOR SELECT
USING (is_active = true);

-- Promo code uses: admins view all, users view own, users can insert own
CREATE POLICY "Admins can view all promo code uses"
ON public.promo_code_uses FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own promo code uses"
ON public.promo_code_uses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can redeem promo codes"
ON public.promo_code_uses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default promo code MYANMARAI20
INSERT INTO public.promo_codes (code, discount_percent, bonus_credits, is_active)
VALUES ('MYANMARAI20', 20, 5, true);

-- Enable realtime for promo_codes
ALTER PUBLICATION supabase_realtime ADD TABLE public.promo_codes;