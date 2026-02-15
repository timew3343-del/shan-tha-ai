import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { query, limit = 5 } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let relevantMemories: any[] = [];

    // Try vector similarity search if we have OpenAI for embeddings
    const { data: settings } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", ["openai_api_key", "api_enabled_openai"]);
    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });

    if (configMap["api_enabled_openai"] !== "false" && configMap["openai_api_key"]) {
      try {
        // Generate embedding for query
        const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${configMap["openai_api_key"]}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: query.slice(0, 8000) }),
        });

        if (embResponse.ok) {
          const embData = await embResponse.json();
          const queryEmbedding = embData.data?.[0]?.embedding;

          if (queryEmbedding) {
            // Vector similarity search
            const { data: vectorResults } = await supabaseAdmin.rpc("match_chat_memories", {
              query_embedding: queryEmbedding,
              match_threshold: 0.7,
              match_count: limit,
              p_user_id: user.id,
            });

            if (vectorResults?.length) {
              relevantMemories = vectorResults;
            }
          }
        }
      } catch (e) {
        console.warn("Vector search failed, falling back to keyword:", e);
      }
    }

    // Fallback: keyword-based search using ILIKE
    if (relevantMemories.length === 0) {
      const keywords = query.split(/\s+/).filter((w: string) => w.length > 2).slice(0, 5);
      if (keywords.length > 0) {
        const orConditions = keywords.map((k: string) => `content.ilike.%${k}%`).join(",");
        const { data: keywordResults } = await supabaseAdmin
          .from("chat_memory")
          .select("content, role, created_at")
          .eq("user_id", user.id)
          .or(orConditions)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (keywordResults?.length) {
          relevantMemories = keywordResults;
        }
      }
    }

    // Format context for AI prompt injection
    let contextText = "";
    if (relevantMemories.length > 0) {
      contextText = relevantMemories
        .map((m: any) => `[${m.role}]: ${m.content}`)
        .join("\n---\n");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      context: contextText, 
      count: relevantMemories.length,
      method: relevantMemories.length > 0 ? "found" : "none",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("rag-query error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});