import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { videoBase64, targetLang, subtitlePosition, subtitleColor } = await req.json();
    if (!videoBase64) {
      return new Response(JSON.stringify({ error: "Video file is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isAdmin = isAdminData === true;

    // Get credit cost with margin
    const { data: costSettings } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_costs").maybeSingle();
    let creditCost = 15;
    if (costSettings?.value) {
      try { const parsed = JSON.parse(costSettings.value); creditCost = parsed.video_subtitle || 15; } catch {}
    }
    const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "global_profit_margin").maybeSingle();
    const margin = marginSetting?.value ? parseFloat(marginSetting.value) : 0;
    if (margin > 0) creditCost = Math.ceil(creditCost * (1 + margin / 100));

    // Check credits
    if (!isAdmin) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", user.id).single();
      if (!profile || profile.credit_balance < creditCost) {
        return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Upload video to storage
    const videoBytes = Uint8Array.from(atob(videoBase64), c => c.charCodeAt(0));
    const videoFileName = `${user.id}/subtitle-input-${Date.now()}.mp4`;
    const { error: uploadErr } = await supabaseAdmin.storage.from("videos").upload(videoFileName, videoBytes.buffer, { contentType: "video/mp4", upsert: true });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: signedData } = await supabaseAdmin.storage.from("videos").createSignedUrl(videoFileName, 86400 * 7);
    const videoUrl = signedData?.signedUrl;

    // Create job
    const { data: job, error: jobErr } = await supabaseAdmin.from("generation_jobs").insert({
      user_id: user.id,
      tool_type: "video_subtitle_translate",
      status: "processing",
      credits_cost: creditCost,
      credits_deducted: false,
      input_params: {
        videoUrl,
        targetLang: targetLang || "my",
        subtitlePosition: subtitlePosition || "bottom_center",
        subtitleColor: subtitleColor || "#FFFFFF",
        isAdmin,
        tool_name: "AI Video Subtitle & Translate",
      },
    }).select("id").single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Failed to create job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Video subtitle job created: ${job.id}`);

    return new Response(JSON.stringify({ status: "processing", jobId: job.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("video-subtitle-translate error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
