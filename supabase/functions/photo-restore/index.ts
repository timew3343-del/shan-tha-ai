import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (imageBase64.length > 15728640) {
      return new Response(JSON.stringify({ error: "Image too large (max 10MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit check
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_photo_restoration").maybeSingle();
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 10;

    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile || profile.credit_balance < creditCost) {
      return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "Replicate API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create prediction using CodeFormer
    console.log(`Photo restore for user ${userId}`);
    const imageDataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const predResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "7bc557ac4295d5b50bab0dd5b7e0590d1a066be9905de16d5d9445cd46ecdbc8",
        input: {
          image: imageDataUrl,
          upscale: 2,
          face_upsample: true,
          background_enhance: true,
          codeformer_fidelity: 0.7,
        },
      }),
    });

    if (!predResponse.ok) {
      const errText = await predResponse.text();
      console.error("Replicate create error:", predResponse.status, errText);
      return new Response(JSON.stringify({ error: "Photo restoration service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prediction = await predResponse.json();
    const maxWait = 120;
    let waited = 0;

    while (prediction.status !== "succeeded" && prediction.status !== "failed" && waited < maxWait) {
      await new Promise(r => setTimeout(r, 3000));
      waited += 3;
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });
      prediction = await pollRes.json();
    }

    if (prediction.status !== "succeeded") {
      return new Response(JSON.stringify({ error: "Photo restoration timed out or failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credits
    await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId, _amount: creditCost, _action: "Photo Restoration",
    });

    const outputUrl = typeof prediction.output === "string" ? prediction.output : prediction.output?.[0] || prediction.output;

    return new Response(JSON.stringify({ success: true, imageUrl: outputUrl, creditsUsed: creditCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Photo restore error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
