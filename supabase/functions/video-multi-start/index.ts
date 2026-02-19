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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      videoUrl,
      autoSubtitles,
      subtitleLanguage = "my",
      creditCost = 10,
    } = body;

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Video URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    // Check credits
    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("credit_balance").eq("user_id", user.id).single();
      if (!profile || profile.credit_balance < creditCost) {
        return new Response(JSON.stringify({
          error: "ခရက်ဒစ် မလုံလောက်ပါ",
          required: creditCost,
          balance: profile?.credit_balance || 0,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Get Replicate API key
    const { data: apiKeys } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", ["replicate_api_token"]);
    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });
    const REPLICATE_API_KEY = keyMap.replicate_api_token || Deno.env.get("REPLICATE_API_KEY");

    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "Replicate API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let externalJobId: string | null = null;
    let toolType = "video_multi_subtitle";

    if (autoSubtitles) {
      // Start Whisper transcription via Replicate
      console.log(`Starting Whisper for: ${videoUrl.substring(0, 80)}...`);
      const whisperResp = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "4d50797290df275329f202e48c76360b3f22b08d28c65c07c8d445c1eeae2a65",
          input: {
            audio: videoUrl,
            model: "large-v3",
            language: "auto",
            translate: false,
            temperature: 0,
            transcription: "srt",
            suppress_tokens: "-1",
            logprob_threshold: -1,
            no_speech_threshold: 0.6,
            condition_on_previous_text: true,
            compression_ratio_threshold: 2.4,
            temperature_increment_on_fallback: 0.2,
          },
        }),
      });

      if (!whisperResp.ok) {
        const errText = await whisperResp.text();
        console.error("Whisper start error:", whisperResp.status, errText);
        return new Response(JSON.stringify({ error: "Whisper transcription failed to start" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const whisperData = await whisperResp.json();
      externalJobId = whisperData.id;
      console.log(`Whisper prediction started: ${externalJobId}`);
    }

    // Create generation job
    const { data: job, error: jobErr } = await supabaseAdmin.from("generation_jobs").insert({
      user_id: user.id,
      tool_type: toolType,
      status: "processing",
      credits_cost: creditCost,
      credits_deducted: false,
      external_job_id: externalJobId,
      input_params: {
        videoUrl,
        autoSubtitles,
        subtitleLanguage,
        isAdmin: userIsAdmin,
        tool_name: "Video Multi-Tool",
      },
    }).select("id").single();

    if (jobErr) {
      console.error("Job creation error:", jobErr);
      return new Response(JSON.stringify({ error: "Failed to create processing job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Job created: ${job.id}, externalId: ${externalJobId}`);

    return new Response(JSON.stringify({
      success: true,
      jobId: job.id,
      message: "Processing started. Poll check-job-status for updates.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("video-multi-start error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
