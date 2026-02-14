import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI API not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Classify issue with AI
    const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a support AI for the "Auto Daily Video Service" on Shan Tha AI platform. 
Respond in Myanmar (Burmese) language.
If the user's question is about:
- Setup, usage, templates, language selection → Answer helpfully in Myanmar
- Technical errors, bugs, video generation failures → Respond with "ESCALATE:" prefix followed by the issue summary, then provide a polite Myanmar message saying their issue has been forwarded to the owner

Always be polite and helpful. Keep responses concise (under 150 words).`,
          },
          { role: "user", content: message },
        ],
        temperature: 0.5,
      }),
    });

    if (!classifyResponse.ok) {
      const errText = await classifyResponse.text();
      throw new Error(`AI error: ${classifyResponse.status} ${errText}`);
    }

    const aiData = await classifyResponse.json();
    const aiResponse = aiData.choices?.[0]?.message?.content || "ဆက်သွယ်မှု မအောင်မြင်ပါ";

    const isEscalated = aiResponse.startsWith("ESCALATE:");
    const cleanResponse = isEscalated ? aiResponse.replace("ESCALATE:", "").trim() : aiResponse;

    // Save to support table
    await supabaseAdmin.from("auto_service_support").insert({
      user_id: userId,
      message,
      ai_response: cleanResponse,
      is_escalated: isEscalated,
      issue_type: isEscalated ? "technical" : "general",
      status: isEscalated ? "escalated" : "resolved",
    });

    return new Response(JSON.stringify({ response: cleanResponse, escalated: isEscalated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Support error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
