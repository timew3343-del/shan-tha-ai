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
      .eq("key", "credit_cost_bg_remove")
      .maybeSingle();

    const creditCost = parseInt(costSetting?.value || "1", 10);

    // Use secure database function to deduct credits
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: deductResult, error: deductError } = await serviceClient.rpc(
      "deduct_user_credits",
      { _user_id: user.id, _amount: creditCost, _action: "remove_bg" }
    );

    if (deductError || !deductResult?.success) {
      return new Response(
        JSON.stringify({ error: deductResult?.error || "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Replicate API for background removal
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Replicate API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting background removal with Replicate API...");

    // Create prediction using rembg model
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        input: {
          image: `data:image/png;base64,${imageBase64}`,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Replicate create error:", errorText);
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Background removal initiation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prediction = await createResponse.json();
    console.log("Prediction created:", prediction.id);

    // Poll for completion
    let result = prediction;
    const maxAttempts = 30;
    let attempts = 0;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;

      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });
      result = await pollResponse.json();
      console.log(`Poll attempt ${attempts}: ${result.status}`);
    }

    if (result.status === "failed") {
      console.error("BG remove failed:", result.error);
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Background removal processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.status !== "succeeded") {
      await serviceClient.rpc("add_user_credits", { _user_id: user.id, _amount: creditCost });
      return new Response(JSON.stringify({ error: "Background removal timed out" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Background removal succeeded!");

    return new Response(
      JSON.stringify({
        image: result.output,
        creditsUsed: creditCost,
        newBalance: deductResult.new_balance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("BG remove error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
