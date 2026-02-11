
-- Create user_outputs table for storing tool outputs with 10-day retention
CREATE TABLE public.user_outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tool_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  output_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 days')
);

-- Enable RLS
ALTER TABLE public.user_outputs ENABLE ROW LEVEL SECURITY;

-- Users can view their own outputs
CREATE POLICY "Users can view own outputs"
ON public.user_outputs FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own outputs  
CREATE POLICY "Users can insert own outputs"
ON public.user_outputs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own outputs
CREATE POLICY "Users can delete own outputs"
ON public.user_outputs FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all outputs
CREATE POLICY "Admins can view all outputs"
ON public.user_outputs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient querying
CREATE INDEX idx_user_outputs_user_id ON public.user_outputs (user_id, created_at DESC);
CREATE INDEX idx_user_outputs_expires ON public.user_outputs (expires_at);

-- Create a function to auto-delete expired outputs (can be called via cron or edge function)
CREATE OR REPLACE FUNCTION public.cleanup_expired_outputs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.user_outputs
  WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create storage bucket for user output files
INSERT INTO storage.buckets (id, name, public) VALUES ('user-outputs', 'user-outputs', false)
ON CONFLICT DO NOTHING;

-- Storage policies for user-outputs bucket
CREATE POLICY "Users can upload own outputs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own output files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own output files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);
