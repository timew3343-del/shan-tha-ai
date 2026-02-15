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

    const { content, role, metadata } = await req.json();
    if (!content || typeof content !== "string" || content.length > 10000) {
      return new Response(JSON.stringify({ error: "Invalid content" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate embedding via Lovable AI Gateway (using a text model for embedding-like representation)
    // We use a simple approach: store content with a hash-based pseudo-embedding for keyword similarity
    // For production, you'd want a proper embedding model
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    let embedding: number[] | null = null;
    
    // Try OpenAI embeddings first
    const { data: settings } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", ["openai_api_key", "api_enabled_openai"]);
    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });
    
    if (configMap["api_enabled_openai"] !== "false" && configMap["openai_api_key"]) {
      try {
        const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${configMap["openai_api_key"]}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: content.slice(0, 8000) }),
        });
        if (embResponse.ok) {
          const embData = await embResponse.json();
          embedding = embData.data?.[0]?.embedding;
        }
      } catch (e) {
        console.warn("OpenAI embedding failed:", e);
      }
    }

    // Store in chat_memory (embedding may be null if no embedding model available)
    const { error: insertError } = await supabaseAdmin
      .from("chat_memory")
      .insert({
        user_id: user.id,
        role: role || "user",
        content,
        embedding,
        metadata: metadata || {},
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store memory" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, has_embedding: !!embedding }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("embed-text error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});