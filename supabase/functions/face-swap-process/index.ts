import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Helper functions =====

async function getShotstackKey(supabaseAdmin: any): Promise<string> {
  const envKey = Deno.env.get("SHOTSTACK_API_KEY");
  if (envKey) return envKey;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "shotstack_api_key").maybeSingle();
  return data?.value || "";
}

async function getReplicateKey(supabaseAdmin: any): Promise<string> {
  const envKey = Deno.env.get("REPLICATE_API_KEY");
  if (envKey) return envKey;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "replicate_api_key").maybeSingle();
  return data?.value || "";
}

async function submitShotstackRender(apiKey: string, timeline: any): Promise<string> {
  const resp = await fetch("https://api.shotstack.io/v1/render", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ timeline, output: { format: "mp4", resolution: "sd" } }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Shotstack render submit failed: ${resp.status} ${txt}`);
  }
  const data = await resp.json();
  return data.response?.id;
}

async function pollShotstackRender(apiKey: string, renderId: string): Promise<{ done: boolean; failed: boolean; url?: string }> {
  const resp = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!resp.ok) return { done: false, failed: false };
  const data = await resp.json();
  const status = data.response?.status;
  if (status === "done") return { done: true, failed: false, url: data.response?.url };
  if (status === "failed") return { done: false, failed: true };
  return { done: false, failed: false };
}

async function submitReplicateFaceSwap(apiKey: string, videoUrl: string, faceUrl: string): Promise<string> {
  const resp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      version: "cdcbfba9b6dbfe7df5b4e6e8ddfd7c0bce2e2fd7dd63cf8d6ba3d7d16bc2d9fb",
      input: { target: videoUrl, source: faceUrl },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Replicate submit failed: ${resp.status} ${txt}`);
  }
  const data = await resp.json();
  return data.id;
}

async function pollReplicatePrediction(apiKey: string, predictionId: string): Promise<{ done: boolean; failed: boolean; url?: string; error?: string }> {
  const resp = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!resp.ok) return { done: false, failed: false };
  const data = await resp.json();
  if (data.status === "succeeded") return { done: true, failed: false, url: data.output };
  if (data.status === "failed" || data.status === "canceled") return { done: false, failed: true, error: data.error };
  return { done: false, failed: false };
}

async function updateJobParams(supabaseAdmin: any, jobId: string, params: any) {
  await supabaseAdmin.from("generation_jobs").update({
    input_params: params,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

// ===== Main handler =====

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

    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("generation_jobs").select("*").eq("id", jobId).single();
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if (job.user_id !== user.id) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Already done?
    if (job.status === "completed") {
      return new Response(JSON.stringify({
        status: "completed",
        progress: 100,
        resultUrl: job.output_url,
        creditsUsed: job.credits_deducted ? job.credits_cost : 0,
        statusText: "ပြီးဆုံးပါပြီ",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (job.status === "failed") {
      return new Response(JSON.stringify({
        status: "failed",
        progress: 0,
        error: job.error_message || "Face swap failed",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const params = job.input_params as any;
    const stage = params.stage || "swapping";
    const REPLICATE_KEY = await getReplicateKey(supabaseAdmin);

    if (!REPLICATE_KEY) {
      throw new Error("Replicate API not configured");
    }

    let result: any;

    switch (stage) {
      // ===== SWAPPING: Face swap each pre-split segment =====
      case "swapping": {
        const segmentUrls = params.segmentUrls as string[];
        const totalSegments = segmentUrls.length;
        const idx = params.currentSwapIndex;

        // Submit face swap for current segment if not yet started
        if (!params.swapPredictions[idx]) {
          console.log(`Job ${jobId}: Submitting face swap for segment ${idx + 1}/${totalSegments}`);
          const predId = await submitReplicateFaceSwap(REPLICATE_KEY, segmentUrls[idx], params.faceUrl);
          params.swapPredictions[idx] = predId;
          await updateJobParams(supabaseAdmin, jobId, params);
          result = {
            status: "processing",
            progress: 25 + (idx / totalSegments) * 55,
            statusText: `Face Swap လုပ်နေသည် (${idx + 1}/${totalSegments})...`,
          };
          break;
        }

        // Poll current prediction
        const predId = params.swapPredictions[idx];
        const poll = await pollReplicatePrediction(REPLICATE_KEY, predId);

        if (poll.done && poll.url) {
          params.swappedUrls.push(poll.url);
          console.log(`Job ${jobId}: Segment ${idx + 1}/${totalSegments} face swap complete`);

          if (params.swappedUrls.length >= totalSegments) {
            // All segments swapped
            if (totalSegments === 1) {
              // Single segment - done, no merge needed (saves Shotstack call!)
              params.stage = "complete";
              params.resultUrl = poll.url;
            } else {
              // Submit Shotstack merge (ONLY Shotstack call in entire pipeline!)
              const SHOTSTACK_KEY = await getShotstackKey(supabaseAdmin);
              if (!SHOTSTACK_KEY) throw new Error("Shotstack API not configured for final merge");
              console.log(`Job ${jobId}: All segments swapped, submitting FINAL merge to Shotstack (1 API call)`);

              const clips = params.swappedUrls.map((url: string, i: number) => {
                const seg = params.segments[i];
                let startTime = 0;
                for (let j = 0; j < i; j++) startTime += params.segments[j].length;
                return {
                  asset: { type: "video", src: url },
                  start: startTime,
                  length: seg.length,
                };
              });

              const timeline = { tracks: [{ clips }] };
              const mergeRenderId = await submitShotstackRender(SHOTSTACK_KEY, timeline);
              params.stage = "merging";
              params.mergeRenderId = mergeRenderId;
            }
          } else {
            // Move to next segment
            params.currentSwapIndex = idx + 1;
          }
        } else if (poll.failed) {
          throw new Error(`Face swap failed for segment ${idx + 1}: ${poll.error || "Unknown error"}`);
        }

        await updateJobParams(supabaseAdmin, jobId, params);
        const swapProgress = params.swappedUrls.length / totalSegments;
        const progress = 25 + swapProgress * 55;
        result = {
          status: "processing",
          progress: Math.round(progress),
          statusText: `Face Swap လုပ်နေသည် (${params.swappedUrls.length}/${totalSegments})...`,
        };
        break;
      }

      // ===== MERGING: Poll Shotstack merge (only Shotstack call!) =====
      case "merging": {
        const SHOTSTACK_KEY = await getShotstackKey(supabaseAdmin);
        const poll = await pollShotstackRender(SHOTSTACK_KEY, params.mergeRenderId);
        if (poll.done && poll.url) {
          params.stage = "complete";
          params.resultUrl = poll.url;
          await updateJobParams(supabaseAdmin, jobId, params);
          result = { status: "processing", progress: 95, statusText: "ပြီးဆုံးတော့မည်..." };
        } else if (poll.failed) {
          throw new Error("Video merging failed");
        } else {
          await updateJobParams(supabaseAdmin, jobId, params);
          result = { status: "processing", progress: 85, statusText: "ဗီဒီယိုအပိုင်းများ ပြန်ပေါင်းနေသည်..." };
        }
        break;
      }

      // ===== COMPLETE: Deduct credits and finalize =====
      case "complete": {
        const finalUrl = params.resultUrl;

        // Deduct credits (only once)
        if (!job.credits_deducted && !params.isAdmin) {
          const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
            _user_id: job.user_id,
            _amount: job.credits_cost,
            _action: params.isLiveCamera ? "Face Swap (Live Camera)" : "Face Swap",
          });
          console.log(`Job ${jobId}: Credits deducted: ${job.credits_cost}`, deductResult);
        }

        // Save output
        try {
          await supabaseAdmin.from("user_outputs").insert({
            user_id: job.user_id,
            tool_id: "face_swap",
            tool_name: "Face Swap",
            output_type: "video",
            file_url: finalUrl,
          });
        } catch (e) { console.warn("Failed to save output:", e); }

        // Mark job completed
        await supabaseAdmin.from("generation_jobs").update({
          status: "completed",
          output_url: finalUrl,
          credits_deducted: true,
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);

        result = {
          status: "completed",
          progress: 100,
          resultUrl: finalUrl,
          creditsUsed: params.isAdmin ? 0 : job.credits_cost,
          statusText: "ပြီးဆုံးပါပြီ",
        };
        break;
      }

      default:
        throw new Error(`Unknown stage: ${stage}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("face-swap-process error:", error);

    // Try to mark job as failed
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.jobId) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from("generation_jobs").update({
          status: "failed",
          error_message: error.message,
          updated_at: new Date().toISOString(),
        }).eq("id", body.jobId);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      status: "failed",
      error: error.message || "Internal error",
      progress: 0,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
