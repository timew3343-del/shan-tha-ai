-- Create app_settings table for storing global settings like API keys and bank details
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage settings
CREATE POLICY "Admins can view all settings"
ON public.app_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
ON public.app_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
ON public.app_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings"
ON public.app_settings
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default bank settings
INSERT INTO public.app_settings (key, value) VALUES 
  ('bank_scb_account', '399-459002-6'),
  ('bank_scb_name_th', 'เงินฝากออมทรัพย์ (ไม่มีสมุดคู่ฝาก)'),
  ('bank_scb_name_en', 'ATASIT KANTHA'),
  ('gemini_api_key', ''),
  ('stability_api_key', '')
ON CONFLICT (key) DO NOTHING;

-- Create Thai Baht pricing packages table
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_mmk integer NOT NULL DEFAULT 0,
  price_thb integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MMK',
  is_best_value boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- Everyone can view active packages
CREATE POLICY "Anyone can view active packages"
ON public.pricing_packages
FOR SELECT
USING (is_active = true);

-- Only admins can manage packages
CREATE POLICY "Admins can manage packages"
ON public.pricing_packages
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_pricing_packages_updated_at
BEFORE UPDATE ON public.pricing_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default MMK packages
INSERT INTO public.pricing_packages (name, credits, price_mmk, price_thb, currency, is_best_value) VALUES 
  ('Starter', 300, 20000, 0, 'MMK', false),
  ('Professional', 700, 40000, 0, 'MMK', true),
  ('Enterprise', 2000, 100000, 0, 'MMK', false),
  ('Starter THB', 300, 0, 250, 'THB', false),
  ('Professional THB', 700, 0, 500, 'THB', true),
  ('Enterprise THB', 2000, 0, 1200, 'THB', false)
ON CONFLICT DO NOTHING;