// Image + Prompt -> 10s video using Replicate (Kling v1.6 standard image-to-video)
// Admin: unlimited (no charge). Users: credit deduction with auto-refund on failure.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getReplicateKey(supabaseAdmin: any): Promise<string | null> {
  const envKey = Deno.env.get("REPLICATE_API_KEY") || Deno.env.get("REPLICATE_API_TOKEN");
  if (envKey) return envKey;
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key,value")
    .in("key", [
      "replicate_api_key",
      "replicate_api_token",
      "REPLICATE_API_KEY_PRIMARY",
      "REPLICATE_API_KEY_SECONDARY",
    ]);
  if (!data) return null;
  for (const row of data) if (row.value) return row.value as string;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return respond({ error: "Invalid token" }, 401);

    const userId = user.id;
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const userIsAdmin = isAdminData === true;

    let body: { prompt?: string; imageBase64?: string; aspectRatio?: string };
    try { body = await req.json(); } catch { return respond({ error: "Invalid request body" }, 400); }

    const prompt = (body.prompt || "").toString().trim();
    const imageBase64 = body.imageBase64;
    const aspectRatio = body.aspectRatio || "16:9";

    if (!imageBase64) return respond({ error: "ပုံ ထည့်ပေးပါ။ Image is required." }, 400);
    if (prompt.length > 1000) return respond({ error: "Prompt အရှည်လွန်းပါသည် (max 1000)" }, 400);

    // Credit cost
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_image_to_video_10s").maybeSingle();
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 25;

    let priorBalance: number | null = null;
    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("credit_balance").eq("user_id", userId).single();
      if (!profile) return respond({ error: "Profile not found" }, 404);
      if (profile.credit_balance < creditCost) {
        return respond({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost, balance: profile.credit_balance }, 402);
      }
      const deduct = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "image_to_video_10s",
      });
      if (deduct.error || deduct.data?.success === false) {
        return respond({ error: deduct.data?.error || "Failed to deduct credits" }, 500);
      }
      priorBalance = profile.credit_balance;
    }

    const refund = async () => {
      if (userIsAdmin) return;
      try {
        await supabaseAdmin.rpc("add_credits_via_service", { _user_id: userId, _amount: creditCost });
      } catch (e) { console.error("Refund failed:", e); }
    };

    const REPLICATE_KEY = await getReplicateKey(supabaseAdmin);
    if (!REPLICATE_KEY) {
      await refund();
      return respond({ error: "Video API key not configured. Admin ထံ ဆက်သွယ်ပါ။" }, 500);
    }

    // Ensure data URI prefix for Replicate
    const dataUri = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    console.log("[i2v-10s] Starting Replicate Kling v1.6 prediction...");
    const startResp = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt: prompt || "smooth natural motion, cinematic",
          start_image: dataUri,
          duration: 10,
          aspect_ratio: aspectRatio,
          cfg_scale: 0.5,
          negative_prompt: "blurry, low quality, distorted",
        },
      }),
    });

    if (!startResp.ok) {
      const errText = await startResp.text();
      console.error("[i2v-10s] Replicate start error:", startResp.status, errText);
      await refund();
      return respond({ error: "Video generation failed to start. ထပ်ကြိုးစားပါ။", details: errText.slice(0, 300) }, 500);
    }

    let prediction = await startResp.json();
    let videoUrl: string | null = null;

    // Poll up to ~5 min if not yet finished
    const deadline = Date.now() + 5 * 60 * 1000;
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
      if (Date.now() > deadline) break;
      await new Promise(r => setTimeout(r, 4000));
      const pollResp = await fetch(prediction.urls?.get, {
        headers: { "Authorization": `Bearer ${REPLICATE_KEY}` },
      });
      if (!pollResp.ok) break;
      prediction = await pollResp.json();
    }

    if (prediction.status === "succeeded") {
      videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    }

    if (!videoUrl) {
      console.error("[i2v-10s] Generation failed:", prediction.status, prediction.error);
      await refund();
      return respond({ error: "ဗီဒီယိုထုတ်လုပ်မှု မအောင်မြင်ပါ။ ခရက်ဒစ် ပြန်ပေးအပ်ပြီးပါပြီ။", status: prediction.status }, 500);
    }

    // Save to user_outputs
    await supabaseAdmin.from("user_outputs").insert({
      user_id: userId,
      tool_id: "image-to-video-10s",
      tool_name: "Image → 10s Video",
      output_type: "video",
      file_url: videoUrl,
      content: prompt || null,
    });

    return respond({
      success: true,
      videoUrl,
      creditsUsed: userIsAdmin ? 0 : creditCost,
      isAdmin: userIsAdmin,
    });
  } catch (error: any) {
    console.error("[i2v-10s] Error:", error);
    return respond({ error: error.message || "Unexpected error" }, 500);
  }
});
