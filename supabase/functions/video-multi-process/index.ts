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
    const { action, videoUrl, creditCost = 5, voice, language, srtText, maskImageBase64 } = body;

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

    // ── TTS: Generate audio from subtitle text ──
    if (action === "tts") {
      if (!srtText || !voice) {
        return new Response(JSON.stringify({ error: "srtText and voice are required for TTS" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract plain text from SRT (remove timestamps and numbers)
      const plainText = srtText
        .split("\n")
        .filter((line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return false;
          if (/^\d+$/.test(trimmed)) return false;
          if (/-->/.test(trimmed)) return false;
          return true;
        })
        .join(" ")
        .trim()
        .substring(0, 4000); // OpenAI TTS limit

      if (!plainText) {
        return new Response(JSON.stringify({ error: "No text content found in SRT" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get OpenAI key
      const { data: openaiSetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "openai_api_key").maybeSingle();
      const openaiKey = openaiSetting?.value;

      if (!openaiKey) {
        return new Response(JSON.stringify({ error: "OpenAI API key not configured for TTS" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`TTS: generating audio for ${plainText.length} chars, voice=${voice}`);

      const ttsResp = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          input: plainText.normalize("NFC"),
          voice: voice,
          response_format: "mp3",
        }),
      });

      if (!ttsResp.ok) {
        const errText = await ttsResp.text();
        console.error("OpenAI TTS error:", ttsResp.status, errText);
        return new Response(JSON.stringify({ error: `TTS generation failed: ${ttsResp.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const audioBuffer = await ttsResp.arrayBuffer();
      const audioFileName = `${user.id}/tts-narration-${Date.now()}.mp3`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from("videos")
        .upload(audioFileName, audioBuffer, { contentType: "audio/mpeg", upsert: true });

      if (uploadErr) {
        return new Response(JSON.stringify({ error: `Audio upload failed: ${uploadErr.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: signedData } = await supabaseAdmin.storage
        .from("videos")
        .createSignedUrl(audioFileName, 3600);

      // Deduct credits
      if (!userIsAdmin && creditCost > 0) {
        await supabaseAdmin.rpc("deduct_user_credits", {
          _user_id: user.id,
          _amount: creditCost,
          _action: "Video Multi-Tool (TTS Narration)",
        });
      }

      console.log(`TTS audio generated: ${audioBuffer.byteLength} bytes`);

      return new Response(JSON.stringify({
        success: true,
        audioUrl: signedData?.signedUrl,
        textLength: plainText.length,
        creditsUsed: userIsAdmin ? 0 : creditCost,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Object Removal via Replicate ──
    if (action === "object_removal") {
      if (!videoUrl) {
        return new Response(JSON.stringify({ error: "videoUrl is required for object removal" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read Replicate key from app_settings first, fallback to env
      const { data: repSetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "replicate_api_token").maybeSingle();
      const REPLICATE_KEY = repSetting?.value || Deno.env.get("REPLICATE_API_KEY");
      if (!REPLICATE_KEY) {
        return new Response(JSON.stringify({ error: "Replicate API key not configured. Set it in Admin > API Management or as an environment secret." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Starting object removal for: ${videoUrl.substring(0, 80)}...`);

      const replicateResp = await fetch("https://api.replicate.com/v1/models/facebook/propainter/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "wait",
        },
        body: JSON.stringify({
          input: {
            video: videoUrl,
            ...(maskImageBase64 ? { mask: maskImageBase64 } : {}),
          },
        }),
      });

      if (!replicateResp.ok) {
        const errText = await replicateResp.text();
        console.error("Replicate error:", replicateResp.status, errText);
        const safeSnippet = (errText || "").substring(0, 500).replace(/Bearer\s+\S+/gi, "Bearer ***");
        return new Response(JSON.stringify({
          error: `Object removal failed (${replicateResp.status})`,
          replicateStatus: replicateResp.status,
          replicateBody: safeSnippet,
        }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const replicateData = await replicateResp.json();
      const predictionId = replicateData.id;

      // Create a background job for polling
      const { data: job, error: jobErr } = await supabaseAdmin.from("generation_jobs").insert({
        user_id: user.id,
        tool_type: "video_multi_object_removal",
        status: "processing",
        credits_cost: creditCost,
        credits_deducted: false,
        external_job_id: predictionId,
        input_params: {
          videoUrl,
          isAdmin: userIsAdmin,
          tool_name: "Video Multi-Tool (Object Removal)",
        },
      }).select("id").single();

      if (jobErr) {
        return new Response(JSON.stringify({ error: "Failed to create job" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Object removal job created: ${job.id}, prediction: ${predictionId}`);

      return new Response(JSON.stringify({
        success: true,
        jobId: job.id,
        message: "Object removal started. Poll check-job-status for updates.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("video-multi-process error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
