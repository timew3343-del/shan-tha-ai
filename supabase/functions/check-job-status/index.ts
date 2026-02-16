import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check - require authenticated user
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

    // Only fetch jobs belonging to this user (unless admin)
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    const query = supabaseAdmin
      .from("generation_jobs")
      .select("*")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true })
      .limit(20);

    // Non-admin users can only see their own jobs
    if (!userIsAdmin) {
      query.eq("user_id", user.id);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error("Error fetching jobs:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch jobs" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch API keys
    const { data: settings } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", ["shotstack_api_key", "suno_api_key"]);
    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });

    const SHOTSTACK_KEY = configMap["shotstack_api_key"] || Deno.env.get("SHOTSTACK_API_KEY");

    let processed = 0;

    for (const job of jobs) {
      try {
        const params = job.input_params as any;
        
        if (job.tool_type === "shotstack" && job.external_job_id) {
          // Poll Shotstack render status
          const statusResp = await fetch(`https://api.shotstack.io/v1/render/${job.external_job_id}`, {
            headers: { "x-api-key": SHOTSTACK_KEY || "" },
          });

          if (statusResp.ok) {
            const statusData = await statusResp.json();
            const renderStatus = statusData.response?.status;

            if (renderStatus === "done") {
              const videoUrl = statusData.response?.url;
              
              // Deduct credits if not yet deducted
              if (!job.credits_deducted && job.credits_cost > 0) {
                await supabaseAdmin.rpc("deduct_user_credits", {
                  _user_id: job.user_id,
                  _amount: job.credits_cost,
                  _action: `Background: ${job.tool_type}`,
                });
              }

              // Save to user_outputs
              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id,
                tool_id: job.tool_type,
                tool_name: params.tool_name || job.tool_type,
                output_type: "video",
                file_url: videoUrl,
                thumbnail_url: statusData.response?.thumbnail,
              });

              // Update job status
              await supabaseAdmin.from("generation_jobs").update({
                status: "completed",
                output_url: videoUrl,
                thumbnail_url: statusData.response?.thumbnail,
                credits_deducted: true,
              }).eq("id", job.id);

              processed++;
            } else if (renderStatus === "failed") {
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: statusData.response?.error || "Render failed",
              }).eq("id", job.id);
              processed++;
            }
            // If still rendering, leave as-is
          }
        }

        // Mark old stuck jobs as failed (older than 30 minutes)
        const jobAge = Date.now() - new Date(job.created_at).getTime();
        if (jobAge > 30 * 60 * 1000) {
          await supabaseAdmin.from("generation_jobs").update({
            status: "failed",
            error_message: "Job timed out after 30 minutes",
          }).eq("id", job.id);
          processed++;
        }
      } catch (jobError: any) {
        console.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    return new Response(JSON.stringify({ processed, total: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("check-job-status error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});