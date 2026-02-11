
-- Knowledge Base table for categorized training data
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  ai_instruction TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Only admins can manage knowledge base
CREATE POLICY "Admins can manage knowledge base"
ON public.knowledge_base FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Everyone can read knowledge base (needed for AI queries)
CREATE POLICY "Authenticated users can read knowledge base"
ON public.knowledge_base FOR SELECT
USING (auth.uid() IS NOT NULL);

-- API Balance Tracking table
CREATE TABLE public.api_balance_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_name TEXT NOT NULL,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  low_balance_threshold NUMERIC NOT NULL DEFAULT 5.00,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_balance_tracking ENABLE ROW LEVEL SECURITY;

-- Only admins
CREATE POLICY "Admins can manage API balance tracking"
ON public.api_balance_tracking FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default API balance entries
INSERT INTO public.api_balance_tracking (api_name, initial_balance, current_balance) VALUES
('Google Gemini', 0, 0),
('Replicate AI', 0, 0),
('Stability AI', 0, 0),
('Shotstack', 0, 0),
('Lovable AI', 0, 0);

-- Add updated_at trigger for knowledge_base
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
