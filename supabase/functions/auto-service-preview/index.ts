import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { language, templateCategory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI API not configured");

    const templatePrompts: Record<string, string> = {
      motivational: "an inspiring motivational quote with life advice",
      buddhist_dhamma: "a Buddhist Dhamma teaching with practical wisdom",
      daily_news: "a brief daily news summary with key world events",
      financial_tips: "a practical financial management tip",
      health_advice: "a health and wellness tip for daily life",
      historical_facts: "an interesting historical fact with context",
      science_tech: "a fascinating science or technology fact",
      cooking_recipes: "a simple cooking recipe with ingredients and steps",
      travel_explore: "an interesting travel destination guide",
      life_hacks: "a useful everyday life hack",
    };

    const topicDesc = templatePrompts[templateCategory] || "interesting daily content";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a content creator. Generate a short 10-second video script preview about ${topicDesc}. Write ENTIRELY in ${language} with 100% correct spelling. Include: a catchy title, a 2-3 sentence script, and suggested visual description. Keep it concise for a 10-second video.`,
          },
          {
            role: "user",
            content: `Generate a 10-second preview script in ${language} for the "${templateCategory}" category. This is for a daily auto-generated video service.`,
          },
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const preview = data.choices?.[0]?.message?.content || "Preview content unavailable";

    return new Response(JSON.stringify({ preview }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Preview error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
