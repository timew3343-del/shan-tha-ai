-- Create campaigns table for free credit system
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    link TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'tiktok')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    credits_awarded INTEGER DEFAULT 0,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own campaigns"
ON public.campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all campaigns"
ON public.campaigns FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaigns"
ON public.campaigns FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Add timestamp trigger
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add face_swap tool settings if not exists
INSERT INTO public.app_settings (key, value)
VALUES 
  ('credit_cost_face_swap', '15'),
  ('face_swap_enabled', 'true')
ON CONFLICT (key) DO NOTHING;