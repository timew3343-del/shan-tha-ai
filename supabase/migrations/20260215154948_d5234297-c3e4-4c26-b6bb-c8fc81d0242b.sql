
-- Enable vector extension for RAG
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Chat Memory table for RAG (pgvector)
CREATE TABLE public.chat_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- HNSW index for fast similarity search
CREATE INDEX chat_memory_embedding_idx ON public.chat_memory 
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX chat_memory_user_id_idx ON public.chat_memory (user_id);

ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories" ON public.chat_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories" ON public.chat_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all memories" ON public.chat_memory
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Daily free usage tracking table
CREATE TABLE public.daily_free_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tool_type TEXT NOT NULL DEFAULT 'image',
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_type, usage_date)
);

CREATE INDEX daily_free_usage_user_date_idx ON public.daily_free_usage (user_id, usage_date);

ALTER TABLE public.daily_free_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own free usage" ON public.daily_free_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own free usage" ON public.daily_free_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own free usage" ON public.daily_free_usage
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all free usage" ON public.daily_free_usage
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Atomic free quota check-and-increment function
CREATE OR REPLACE FUNCTION public.check_and_use_free_quota(
  _user_id UUID,
  _tool_type TEXT DEFAULT 'image',
  _daily_limit INTEGER DEFAULT 5
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_count INTEGER;
  _today DATE := CURRENT_DATE;
BEGIN
  -- Verify caller
  IF auth.uid() != _user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Upsert and get current count
  INSERT INTO daily_free_usage (user_id, tool_type, usage_date, usage_count)
  VALUES (_user_id, _tool_type, _today, 0)
  ON CONFLICT (user_id, tool_type, usage_date) DO NOTHING;

  SELECT usage_count INTO _current_count
  FROM daily_free_usage
  WHERE user_id = _user_id AND tool_type = _tool_type AND usage_date = _today
  FOR UPDATE;

  IF _current_count >= _daily_limit THEN
    RETURN json_build_object('success', false, 'is_free', false, 'used', _current_count, 'limit', _daily_limit);
  END IF;

  -- Increment
  UPDATE daily_free_usage
  SET usage_count = usage_count + 1
  WHERE user_id = _user_id AND tool_type = _tool_type AND usage_date = _today;

  RETURN json_build_object('success', true, 'is_free', true, 'used', _current_count + 1, 'limit', _daily_limit, 'remaining', _daily_limit - _current_count - 1);
END;
$$;

-- Generation jobs table for background processing
CREATE TABLE public.generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tool_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_url TEXT,
  thumbnail_url TEXT,
  credits_cost INTEGER NOT NULL DEFAULT 0,
  credits_deducted BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  external_job_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX generation_jobs_user_idx ON public.generation_jobs (user_id);
CREATE INDEX generation_jobs_status_idx ON public.generation_jobs (status);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own jobs" ON public.generation_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON public.generation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all jobs" ON public.generation_jobs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for generation_jobs so frontend can poll
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;

-- Trigger for updated_at on generation_jobs
CREATE TRIGGER update_generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add daily_free_image_limit to app_settings RLS
-- (already covered by 'Users can view public system settings' policy - we'll add the key there)
