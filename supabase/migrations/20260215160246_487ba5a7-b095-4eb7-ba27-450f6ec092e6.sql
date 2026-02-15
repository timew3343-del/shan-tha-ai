
-- Create vector similarity search function for RAG
CREATE OR REPLACE FUNCTION public.match_chat_memories(
  query_embedding extensions.vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role TEXT,
  content TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.user_id,
    cm.role,
    cm.content,
    1 - (cm.embedding <=> query_embedding) AS similarity,
    cm.created_at
  FROM chat_memory cm
  WHERE cm.user_id = p_user_id
    AND cm.embedding IS NOT NULL
    AND 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
