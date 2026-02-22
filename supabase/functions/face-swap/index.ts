import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Maintenance check
    const { data: maintenanceSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "is_maintenance_mode").maybeSingle();
    if (maintenanceSetting?.value === "true") {
      return new Response(JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { videoPath, facePath, duration, isLiveCamera } = body;

    if (!videoPath || !facePath) {
      return new Response(JSON.stringify({ error: "Video and face image paths are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!duration || duration <= 0 || duration > 300) {
      return new Response(JSON.stringify({ error: "ဗီဒီယိုသည် ၅ မိနစ်အတွင်းသာ ဖြစ်ရပါမည်" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate credits: per-minute rate × number of minutes
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_face_swap").maybeSingle();
    const creditPerMinute = costSetting?.value ? parseInt(costSetting.value, 10) : 62;
    const totalMinutes = Math.ceil(duration / 60);
    const creditCost = totalMinutes * creditPerMinute;

    // Check balance
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!userIsAdmin && profile.credit_balance < creditCost) {
      return new Response(JSON.stringify({
        error: "ခရက်ဒစ် မလုံလောက်ပါ",
        required: creditCost,
        balance: profile.credit_balance,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create signed URLs for video and face image
    const { data: videoSignedUrl } = await supabaseAdmin.storage
      .from("videos").createSignedUrl(videoPath, 7200); // 2 hours
    const { data: faceSignedUrl } = await supabaseAdmin.storage
      .from("videos").createSignedUrl(facePath, 7200);

    if (!videoSignedUrl?.signedUrl || !faceSignedUrl?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to access uploaded files" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate segments (60s each)
    const segments: { trim: number; length: number }[] = [];
    let remaining = duration;
    let offset = 0;
    while (remaining > 0) {
      const segLen = Math.min(60, remaining);
      segments.push({ trim: offset, length: segLen });
      offset += segLen;
      remaining -= segLen;
    }

    // Estimate processing time (minutes)
    const estimatedMinutes = Math.max(3, Math.ceil(segments.length * 1.5) + 2);

    // Create generation job
    const { data: job, error: jobErr } = await supabaseAdmin.from("generation_jobs").insert({
      user_id: userId,
      tool_type: "face_swap_pipeline",
      status: "processing",
      credits_cost: creditCost,
      credits_deducted: false,
      input_params: {
        videoUrl: videoSignedUrl.signedUrl,
        faceUrl: faceSignedUrl.signedUrl,
        duration,
        segments,
        isLiveCamera: !!isLiveCamera,
        isAdmin: userIsAdmin,
        stage: "init",
        splitRenderIds: [],
        splitUrls: [],
        swapPredictions: [],
        swappedUrls: [],
        currentSwapIndex: 0,
        mergeRenderId: null,
        resultUrl: null,
      },
    }).select("id").single();

    if (jobErr) {
      console.error("Job creation error:", jobErr);
      return new Response(JSON.stringify({ error: "Failed to create processing job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Face swap job created: ${job.id}, segments: ${segments.length}, credits: ${creditCost}, admin: ${userIsAdmin}`);

    return new Response(JSON.stringify({
      success: true,
      jobId: job.id,
      creditCost,
      segments: segments.length,
      estimatedMinutes,
      message: "Processing started",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Face swap error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
