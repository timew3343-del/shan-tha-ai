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

    let body: { prompt: string; imageBase64: string; duration?: number };
    try { body = await req.json(); } catch { return respond({ error: "Invalid request body" }, 400); }

    const { prompt, imageBase64, duration } = body;
    if (!imageBase64) return respond({ error: "Image is required" }, 400);

    // Calculate credit cost
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_image_to_video").maybeSingle();
    let creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 20;

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

    // Get Stability AI API Key
    const { data: apiKeySetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "stability_api_key").maybeSingle();
    const STABILITY_KEY = apiKeySetting?.value;

    if (!STABILITY_KEY) {
      // Refund credits
      if (!userIsAdmin) {
        const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
        await supabaseAdmin.from("profiles").update({ credit_balance: profile.credit_balance + creditCost }).eq("user_id", userId);
      }
      return respond({ error: "Stability AI API key not configured" }, 500);
    }

    // Convert base64 to Blob
    const byteCharacters = atob(imageBase64.split(",")[1] || imageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const imageBlob = new Blob([byteArray], { type: "image/png" });

    // Prepare FormData for Stability AI
    const formData = new FormData();
    formData.append("image", imageBlob, "image.png");
    formData.append("seed", "0");
    formData.append("cfg_scale", "1.8");
    formData.append("motion_bucket_id", "127");

    console.log("Calling Stability AI Image-to-Video API...");
    const response = await fetch("https://api.stability.ai/v2beta/image-to-video", {
      method: "POST",
      headers: { "Authorization": `Bearer ${STABILITY_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Stability error:", response.status, errText);
      // Refund credits
      if (!userIsAdmin) {
        const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
        await supabaseAdmin.from("profiles").update({ credit_balance: profile.credit_balance + creditCost }).eq("user_id", userId);
      }
      return respond({ error: "Video generation failed to start. Please try again." }, 500);
    }

    const data = await response.json();
    const taskId = data.id;

    // Store task in background processing table
    await supabaseAdmin.from("background_tasks").insert({
      user_id: userId,
      task_id: taskId,
      provider: "stability_ai",
      task_type: "image_to_video",
      status: "processing",
      metadata: { prompt, creditCost }
    });

    return respond({ success: true, taskId, provider: "stability_ai", message: "Image-to-Video generation started in background." });

  } catch (error: any) {
    console.error("Image-to-Video error:", error);
    return respond({ error: error.message }, 500);
  }
});
