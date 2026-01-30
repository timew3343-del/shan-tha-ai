import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credit cost from settings
    const { data: costSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "credit_cost_upscale")
      .maybeSingle();

    const creditCost = parseInt(costSetting?.value || "1", 10);

    // Use secure database function to deduct credits
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: deductResult, error: deductError } = await serviceClient.rpc(
      "deduct_user_credits",
      { _user_id: user.id, _amount: creditCost, _action: "upscale_image" }
    );

    if (deductError || !deductResult?.success) {
      return new Response(
        JSON.stringify({ error: deductResult?.error || "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Replicate API for upscaling
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      // Refund credits
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Replicate API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting upscale with Replicate API...");

    // Create prediction
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        input: {
          image: `data:image/png;base64,${imageBase64}`,
          scale: 4,
          face_enhance: true,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Replicate create error:", errorText);
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Upscale initiation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prediction = await createResponse.json();
    console.log("Prediction created:", prediction.id);

    // Poll for completion
    let result = prediction;
    const maxAttempts = 60;
    let attempts = 0;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });
      result = await pollResponse.json();
      console.log(`Poll attempt ${attempts}: ${result.status}`);
    }

    if (result.status === "failed") {
      console.error("Upscale failed:", result.error);
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Upscale processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.status !== "succeeded") {
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Upscale timed out" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Upscale succeeded!");

    return new Response(
      JSON.stringify({
        image: result.output,
        creditsUsed: creditCost,
        newBalance: deductResult.new_balance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Upscale error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
