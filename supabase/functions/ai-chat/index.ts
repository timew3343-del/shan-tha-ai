import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetch OpenAI key dynamically from app_settings
async function getOpenAIKey(supabaseAdmin: any): Promise<string | null> {
  const { data: settings } = await supabaseAdmin
    .from("app_settings").select("key, value")
    .in("key", ["openai_api_key", "api_enabled_openai"]);
  const configMap: Record<string, string> = {};
  settings?.forEach((s: any) => { configMap[s.key] = s.value; });
  if (configMap["api_enabled_openai"] === "false") return null;
  return configMap["openai_api_key"] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }),
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

    const systemPrompt = "You are a helpful AI assistant for Myanmar users on Myanmaraistudio.com. Respond in Myanmar language when the user writes in Myanmar. Be concise, friendly, and accurate. If analyzing images, describe what you see clearly.";

    const userContent: any[] = [];
    if (imageBase64 && imageType) {
      userContent.push({ type: "image_url", image_url: { url: `data:${imageType};base64,${imageBase64}` } });
    }
    userContent.push({ type: "text", text: message });

    // Try OpenAI GPT-4o first (streaming)
    const openaiKey = await getOpenAIKey(supabaseAdmin);
    let response: Response;
    let modelUsed = "gpt-4o";

    if (openaiKey) {
      console.log("AI Chat: Using OpenAI GPT-4o (primary)");
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn("OpenAI streaming failed:", response.status, errText.substring(0, 200));
        // Fall through to Lovable AI
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

      console.log("AI Chat: Using Lovable AI Gateway (fallback)");
      modelUsed = "gemini-3-flash-preview";
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
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
      await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "AI Chat"
      });
    } else {
      console.log("Admin free access - skipping credit deduction for AI Chat");
    }

    console.log(`AI Chat completed with model: ${modelUsed}`);

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
