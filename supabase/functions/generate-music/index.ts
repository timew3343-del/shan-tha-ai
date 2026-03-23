import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function isAdmin(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return respond({ error: "Invalid token" }, 401);

    const userId = user.id;
    const userIsAdmin = await isAdmin(supabaseAdmin, userId);

    let body: { prompt: string; duration?: number; tags?: string; title?: string };
    try { body = await req.json(); } catch { return respond({ error: "Invalid request body" }, 400); }

    const { prompt, duration, tags, title } = body;
    if (!prompt) return respond({ error: "Prompt is required" }, 400);

    // Calculate credit cost
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_music_generation").maybeSingle();
    let creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 10;

    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
      if (!profile || profile.credit_balance < creditCost) {
        return respond({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }, 402);
      }
      
      // Deduct credits
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ credit_balance: profile.credit_balance - creditCost })
        .eq("user_id", userId);
      
      if (updateError) throw updateError;
    }

    // Get API Keys
    const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", [
      "sunoapi_org_key", "goapi_suno_api_key"
    ]);
    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });

    let taskId = "";
    let provider = "";

    // Try SunoAPI.org
    if (keyMap.sunoapi_org_key) {
      const resp = await fetch("https://api.sunoapi.org/api/v1/generate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${keyMap.sunoapi_org_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          tags: tags || "pop, upbeat",
          title: title || "AI Generated Music",
          make_instrumental: false,
          mv: "chirp-v3-5",
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        taskId = data.data?.taskId || data.data?.task_id;
        provider = "sunoapi_org";
      }
    }

    // Fallback to GoAPI Suno
    if (!taskId && keyMap.goapi_suno_api_key) {
      const resp = await fetch("https://api.goapi.ai/api/suno/v1/music", {
        method: "POST",
        headers: { "X-API-Key": keyMap.goapi_suno_api_key, "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_mode: false,
          input: { prompt: prompt },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        taskId = data.data?.task_id;
        provider = "goapi_suno";
      }
    }

    if (!taskId) {
      // Refund credits if failed
      if (!userIsAdmin) {
        const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
        await supabaseAdmin.from("profiles").update({ credit_balance: profile.credit_balance + creditCost }).eq("user_id", userId);
      }
      return respond({ error: "Music generation failed to start. Please try again." }, 500);
    }

    // Store task in background processing table
    await supabaseAdmin.from("background_tasks").insert({
      user_id: userId,
      task_id: taskId,
      provider: provider,
      task_type: "music_generation",
      status: "processing",
      metadata: { prompt, creditCost }
    });

    return respond({ success: true, taskId, provider, message: "Music generation started in background." });

  } catch (error: any) {
    console.error("Music generation error:", error);
    return respond({ error: error.message }, 500);
  }
});
