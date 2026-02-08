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

    const { personImage, garmentImage } = body;
    if (!personImage || !garmentImage) {
      return new Response(JSON.stringify({ error: "Both person and garment images are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit check
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_virtual_tryon").maybeSingle();
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 15;

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

    console.log(`Virtual try-on for user ${userId}`);
    const personDataUrl = personImage.startsWith("data:") ? personImage : `data:image/jpeg;base64,${personImage}`;
    const garmentDataUrl = garmentImage.startsWith("data:") ? garmentImage : `data:image/jpeg;base64,${garmentImage}`;

    const predResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "c871bb9b046c1f07fcf717fc39e6583e2b6eb4e5ab5c3748a1b2af4f3b88f8e0",
        input: {
          human_img: personDataUrl,
          garm_img: garmentDataUrl,
          category: "upper_body",
        },
      }),
    });

    if (!predResponse.ok) {
      const errText = await predResponse.text();
      console.error("Replicate create error:", predResponse.status, errText);
      return new Response(JSON.stringify({ error: "Virtual try-on service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prediction = await predResponse.json();
    let waited = 0;
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && waited < 180) {
      await new Promise(r => setTimeout(r, 3000));
      waited += 3;
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });
      prediction = await pollRes.json();
    }

    if (prediction.status !== "succeeded") {
      return new Response(JSON.stringify({ error: "Virtual try-on timed out or failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId, _amount: creditCost, _action: "Virtual Try-On",
    });

    const outputUrl = typeof prediction.output === "string" ? prediction.output : prediction.output?.[0] || prediction.output;

    return new Response(JSON.stringify({ success: true, imageUrl: outputUrl, creditsUsed: creditCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Virtual try-on error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
