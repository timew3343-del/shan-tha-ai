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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub;
    console.log(`User ${userId} requesting upscale`);

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credit cost from settings
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "credit_cost_upscale")
      .maybeSingle();

    const creditCost = parseInt(costSetting?.value || "1", 10);

    // Check user credits first
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (!profile || profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Replicate API for upscaling
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting upscale with Replicate API...");

    // Create prediction using Real-ESRGAN
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
      
      if (createResponse.status === 402 || errorText.includes("insufficient") || errorText.includes("balance")) {
        return new Response(JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
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
      return new Response(JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.status !== "succeeded") {
      return new Response(JSON.stringify({ error: "Upscale timed out. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credits AFTER success
    const { data: deductResult } = await supabaseAdmin.rpc(
      "deduct_user_credits",
      { _user_id: userId, _amount: creditCost, _action: "upscale_image" }
    );

    console.log("Upscale succeeded!");

    return new Response(
      JSON.stringify({
        image: result.output,
        creditsUsed: creditCost,
        newBalance: deductResult?.new_balance,
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
