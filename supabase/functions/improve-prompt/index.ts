import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userPrompt, language } = await req.json();
    if (!userPrompt?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt ထည့်ပါ" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read OpenAI key from admin settings
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", ["openai_api_key", "api_enabled_openai"]);

    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });

    const openaiEnabled = configMap["api_enabled_openai"] !== "false";
    const openaiKey = configMap["openai_api_key"];

    const systemContent = `You are a professional video prompt engineer for Myanmaraistudio.com's Auto Daily Video service. Your ONLY job is to take a user's simple idea and rewrite it as a professional, detailed video production prompt.

RULES:
- Output ONLY the improved prompt. No explanations, no greetings, no extra text.
- Write in proper ${language || "Myanmar"} Unicode (if Myanmar, use correct Unicode).
- Include specific details: voice style, background music mood, visual quality, video tone.
- Keep it concise but professional (2-4 sentences max).
- Never mention any other website or domain. Only reference Myanmaraistudio.com if needed.
- Do NOT have a conversation. Just return the improved prompt text.`;

    const messages = [
      { role: "system", content: systemContent },
      { role: "user", content: userPrompt.trim() },
    ];

    let improvedPrompt = "";

    // Try OpenAI first if available
    if (openaiEnabled && openaiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7, max_tokens: 500 }),
        });
        if (response.ok) {
          const data = await response.json();
          improvedPrompt = data.choices?.[0]?.message?.content?.trim() || "";
        } else {
          console.warn("OpenAI failed:", response.status);
        }
      } catch (e: any) {
        console.warn("OpenAI error:", e.message);
      }
    }

    // Fallback to Lovable AI
    if (!improvedPrompt) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, temperature: 0.7, max_tokens: 500 }),
      });
      if (response.ok) {
        const data = await response.json();
        improvedPrompt = data.choices?.[0]?.message?.content?.trim() || "";
      } else {
        const errText = await response.text();
        console.error("Lovable AI error:", response.status, errText);
        throw new Error("AI service error");
      }
    }

    if (!improvedPrompt) {
      throw new Error("AI returned empty response");
    }

    return new Response(JSON.stringify({ improvedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Improve prompt error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
