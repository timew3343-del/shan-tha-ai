import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { question, category } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (!profile || profile.credit_balance < 1) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search knowledge base - simple text search
    let query = supabaseAdmin
      .from("knowledge_base")
      .select("title, content, image_url, ai_instruction, category");

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data: knowledgeData } = await query;

    // Simple keyword matching for relevant entries
    const questionLower = question.toLowerCase();
    const keywords = questionLower.split(/\s+/).filter((w: string) => w.length > 2);
    
    const relevantEntries = (knowledgeData || [])
      .map(entry => {
        const textToSearch = `${entry.title} ${entry.content || ""} ${entry.ai_instruction || ""}`.toLowerCase();
        const matchScore = keywords.reduce((score: number, kw: string) => {
          return score + (textToSearch.includes(kw) ? 1 : 0);
        }, 0);
        return { ...entry, matchScore };
      })
      .filter(e => e.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    // Build context for AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt: string;
    let contextText: string;

    if (relevantEntries.length > 0) {
      contextText = relevantEntries.map(e => {
        let text = `[${e.category}] ${e.title}:\n${e.content || ""}`;
        if (e.ai_instruction) text += `\n(AI Instruction: ${e.ai_instruction})`;
        return text;
      }).join("\n\n---\n\n");

      systemPrompt = `You are a specialized Myanmar AI assistant. You MUST answer ONLY using the knowledge base data provided below. Do NOT use general knowledge. Follow any AI Instructions attached to the data entries.

KNOWLEDGE BASE DATA:
${contextText}

RULES:
1. Answer professionally in Myanmar language.
2. Only use the data provided above.
3. If the data has specific AI Instructions, follow them precisely.
4. Do not make up or hallucinate information.`;
    } else {
      systemPrompt = `You are a specialized Myanmar AI assistant. The user asked a question but NO relevant data was found in the knowledge base.

RESPOND WITH EXACTLY: "ယခုအချက်အလက်ကို ကျွန်ုပ်၏စာကြည့်တိုက်တွင် မတွေ့ရှိသေးပါ။ မကြာမီ ထည့်သွင်းပေးပါမည်။"

Do NOT provide any other information or general knowledge.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credits
    await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: 1,
      _action: "Knowledge Query",
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("Knowledge query error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
