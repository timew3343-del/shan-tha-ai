import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check maintenance mode
    const { data: maintenanceSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "is_maintenance_mode")
      .maybeSingle();

    if (maintenanceSetting?.value === "true") {
      return new Response(
        JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    console.log(`User ${userId} requesting video redesign`);

    // Parse and validate request body
    let parsedBody: { inputVideo?: string; prompt?: string };
    try {
      parsedBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { inputVideo, prompt } = parsedBody;

    if (!inputVideo || typeof inputVideo !== "string" || !prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Input video and prompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (inputVideo.length > 52428800) { // ~50MB
      return new Response(
        JSON.stringify({ error: "Video too large (max 50MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (prompt.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Prompt too long (max 5000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fixed 70% profit margin for this tool
    const PROFIT_MARGIN = 70;
    const BASE_COST = 12;
    const creditCost = Math.ceil(BASE_COST * (1 + PROFIT_MARGIN / 100));

    console.log(`Video Redesign credit cost: ${creditCost} (base: ${BASE_COST}, margin: ${PROFIT_MARGIN}%)`);

    // Check user credits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({
          error: "ခရက်ဒစ် မလုံလောက်ပါ",
          required: creditCost,
          balance: profile.credit_balance,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Replicate API key
    const { data: apiKeySetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "replicate_api_token")
      .maybeSingle();

    const REPLICATE_API_KEY = apiKeySetting?.value || Deno.env.get("REPLICATE_API_KEY");

    if (!REPLICATE_API_KEY) {
      console.error("REPLICATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting video redesign with Replicate API...");

    // Use animate-diff / video-to-video style transfer model
    // Using minimax/video-01-live as a reliable video generation model
    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "c28040c4308b6e3c2ab01c38de334266db2fef853ee6788c93b5a4bde43df03c",
        input: {
          video: inputVideo.startsWith("data:") ? inputVideo : `data:video/mp4;base64,${inputVideo}`,
          prompt: prompt,
          negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy",
          num_inference_steps: 25,
          guidance_scale: 7.5,
          strength: 0.65,
        },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("Replicate start error:", startResponse.status, errorText);

      if (startResponse.status === 402 || errorText.includes("insufficient") || errorText.includes("balance")) {
        // Auto maintenance mode
        await supabaseAdmin
          .from("app_settings")
          .upsert({ key: "is_maintenance_mode", value: "true" }, { onConflict: "key" });

        return new Response(
          JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ။ ခေတ္တစောင့်ဆိုင်းပေးပါ။" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Video redesign failed: ${startResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startData = await startResponse.json();
    const predictionId = startData.id;

    if (!predictionId) {
      console.error("No prediction ID:", startData);
      return new Response(
        JSON.stringify({ error: "Video redesign failed - no prediction ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Video redesign started with ID: ${predictionId}`);

    // Poll for completion (max 8 minutes)
    const maxAttempts = 96;
    let resultUrl: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
        }
      );

      if (!pollResponse.ok) {
        console.error("Poll error:", pollResponse.status);
        continue;
      }

      const pollData = await pollResponse.json();
      console.log(`Poll attempt ${attempt + 1}: status = ${pollData.status}`);

      if (pollData.status === "succeeded") {
        // Output could be a string URL or array
        resultUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
        break;
      }

      if (pollData.status === "failed" || pollData.status === "canceled") {
        console.error("Video redesign failed:", pollData.error);
        return new Response(
          JSON.stringify({
            error: "Video redesign failed. Please try a different prompt or video.",
            details: pollData.error,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!resultUrl) {
      console.error("Video redesign timed out");
      return new Response(
        JSON.stringify({ error: "Video redesign timed out. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits AFTER success
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc(
      "deduct_user_credits",
      {
        _user_id: userId,
        _amount: creditCost,
        _action: "Video Redesign (Style Transfer)",
      }
    );

    if (deductError) {
      console.error("Credit deduction error:", deductError);
    }

    // Log to audit
    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId,
      amount: creditCost,
      credit_type: "deduction",
      description: `Video Redesign: ${prompt.substring(0, 50)}`,
    });

    const newBalance = deductResult?.new_balance ?? profile.credit_balance - creditCost;

    console.log(`Video redesign successful for user ${userId}, cost: ${creditCost}, new balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        video: resultUrl,
        creditsUsed: creditCost,
        newBalance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Video redesign error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
