import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { videoId, language } = body;

    if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return new Response(JSON.stringify({ error: "Invalid video ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get credit cost from admin settings
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_youtube_to_text").maybeSingle();
    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      creditCost = Math.ceil(10 * (1 + profitMargin / 100));
    }

    // Admin bypass + credit check
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!userIsAdmin) {
      if (!profile || profile.credit_balance < creditCost) {
        return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile?.credit_balance || 0 }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validLanguages = ['my', 'en', 'th', 'zh', 'ja', 'ko'];
    const safeLang = validLanguages.includes(language) ? language : 'en';
    const languageNames: Record<string, string> = { 'my': 'Myanmar (Burmese)', 'en': 'English', 'th': 'Thai', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean' };
    const languageName = languageNames[safeLang] || 'English';

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: `Please transcribe the audio/spoken content from this YouTube video: https://www.youtube.com/watch?v=${videoId}\n\nOutput in ${languageName} language. Return ONLY the transcribed/translated text.` }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const transcribedText = data.choices?.[0]?.message?.content || "";
    if (!transcribedText) {
      return new Response(JSON.stringify({ error: "No transcription generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduct credits (skip for admin)
    let newBalance = profile?.credit_balance || 0;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "YouTube to text"
      });
      newBalance = deductResult?.new_balance ?? (profile!.credit_balance - creditCost);
    } else {
      console.log("Admin free access - skipping credit deduction for YouTube-to-text");
    }

    return new Response(JSON.stringify({ success: true, text: transcribedText, creditsUsed: userIsAdmin ? 0 : creditCost, newBalance }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("YouTube to text error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
