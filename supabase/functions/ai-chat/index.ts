import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getOpenAIKey(supabaseAdmin: any): Promise<string | null> {
  const { data: settings } = await supabaseAdmin
    .from("app_settings").select("key, value")
    .in("key", ["openai_api_key", "api_enabled_openai"]);
  const configMap: Record<string, string> = {};
  settings?.forEach((s: any) => { configMap[s.key] = s.value; });
  if (configMap["api_enabled_openai"] === "false") return null;
  return configMap["openai_api_key"] || null;
}

// RAG: Retrieve relevant context from chat_memory
async function getRAGContext(supabaseAdmin: any, userId: string, query: string, openaiKey: string | null): Promise<string> {
  try {
    // Try vector search if OpenAI is available
    if (openaiKey) {
      const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: query.slice(0, 8000) }),
      });

      if (embResponse.ok) {
        const embData = await embResponse.json();
        const queryEmbedding = embData.data?.[0]?.embedding;
        if (queryEmbedding) {
          const { data: results } = await supabaseAdmin.rpc("match_chat_memories", {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: 5,
            p_user_id: userId,
          });
          if (results?.length) {
            return results.map((r: any) => `[${r.role}]: ${r.content}`).join("\n---\n");
          }
        }
      }
    }

    // Fallback: keyword search
    const keywords = query.split(/\s+/).filter((w: string) => w.length > 2).slice(0, 3);
    if (keywords.length > 0) {
      const orConditions = keywords.map((k: string) => `content.ilike.%${k}%`).join(",");
      const { data: results } = await supabaseAdmin
        .from("chat_memory")
        .select("content, role")
        .eq("user_id", userId)
        .or(orConditions)
        .order("created_at", { ascending: false })
        .limit(3);
      if (results?.length) {
        return results.map((r: any) => `[${r.role}]: ${r.content}`).join("\n---\n");
      }
    }
  } catch (e) {
    console.warn("RAG context retrieval failed:", e);
  }
  return "";
}

// Store message in chat_memory with embedding
async function storeMemory(supabaseAdmin: any, userId: string, role: string, content: string, openaiKey: string | null) {
  try {
    let embedding: number[] | null = null;
    if (openaiKey) {
      const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: content.slice(0, 8000) }),
      });
      if (embResponse.ok) {
        const embData = await embResponse.json();
        embedding = embData.data?.[0]?.embedding;
      }
    }
    await supabaseAdmin.from("chat_memory").insert({ user_id: userId, role, content: content.slice(0, 5000), embedding });
  } catch (e) {
    console.warn("Failed to store memory:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { message, imageBase64, imageType } = body;

    // Input validation
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof message !== "string" || message.length > 10000) {
      return new Response(JSON.stringify({ error: "Message too long (max 10000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Credit cost
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_ai_chat").maybeSingle();
    let creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 2;

    // Admin bypass + credit check
    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("credit_balance").eq("user_id", userId).single();
      if (!profile || profile.credit_balance < creditCost) {
        return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile?.credit_balance || 0 }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Get OpenAI key for embeddings
    const openaiKey = await getOpenAIKey(supabaseAdmin);

    // RAG: Retrieve relevant past context
    const ragContext = await getRAGContext(supabaseAdmin, userId, message, openaiKey);

    // Store user message in memory (don't await - fire and forget)
    storeMemory(supabaseAdmin, userId, "user", message, openaiKey);

    // Build system prompt with RAG context
    let systemPrompt = "You are a helpful AI assistant for Myanmar users on Myanmaraistudio.com. Respond in Myanmar language when the user writes in Myanmar. Be concise, friendly, and accurate. If analyzing images, describe what you see clearly.";
    
    if (ragContext) {
      systemPrompt += `\n\n--- MEMORY CONTEXT (Previous relevant conversations) ---\n${ragContext}\n--- END MEMORY ---\nUse the above context to provide more personalized and contextually aware responses. Do not explicitly mention that you're using memory unless asked.`;
    }

    const userContent: any[] = [];
    if (imageBase64 && imageType) {
      userContent.push({ type: "image_url", image_url: { url: `data:${imageType};base64,${imageBase64}` } });
    }
    userContent.push({ type: "text", text: message });

    // Try OpenAI GPT-4o first (streaming)
    let response: Response;
    let modelUsed = "gpt-4o";

    if (openaiKey) {
      console.log("AI Chat: Using OpenAI GPT-4o (primary) with RAG context:", ragContext ? "yes" : "no");
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn("OpenAI streaming failed:", response.status, errText.substring(0, 200));
        response = null as any;
      }
    }

    // Fallback to Lovable AI Gateway
    if (!response || !response.ok) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("AI Chat: Using Lovable AI Gateway (fallback) with RAG:", ragContext ? "yes" : "no");
      modelUsed = "gemini-3-flash-preview";
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Lovable AI error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: "AI service error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Deduct credits (skip for admin)
    if (!userIsAdmin) {
      await supabaseAdmin.rpc("deduct_user_credits", { _user_id: userId, _amount: creditCost, _action: "AI Chat" });
    }

    // Stream response and collect for memory storage
    const originalBody = response.body!;
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    let fullAssistantResponse = "";

    (async () => {
      const reader = originalBody.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
          
          // Parse for memory storage
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullAssistantResponse += content;
            } catch {}
          }
        }
      } finally {
        writer.close();
        // Store assistant response in memory
        if (fullAssistantResponse.length > 10) {
          storeMemory(supabaseAdmin, userId, "assistant", fullAssistantResponse, openaiKey);
        }
      }
    })();

    console.log(`AI Chat completed with model: ${modelUsed}`);

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});