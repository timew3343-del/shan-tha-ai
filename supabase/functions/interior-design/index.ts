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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, style, roomType } = body;
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Room image is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_interior_design").maybeSingle();
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 15;

    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!userIsAdmin && (!profile || profile.credit_balance < creditCost)) {
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

    console.log(`Interior design for user ${userId}, style: ${style}, room: ${roomType}`);
    const imageDataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const designStyle = style || "modern minimalist";
    const room = roomType || "living room";
    const prompt = `Interior design of a ${room}, ${designStyle} style, professional photography, beautiful lighting, high-end furniture, magazine quality, 8k resolution`;

    const predResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38",
        input: {
          image: imageDataUrl,
          prompt: prompt,
          guidance_scale: 15,
          negative_prompt: "low quality, blurry, distorted, ugly",
          prompt_strength: 0.5,
          num_inference_steps: 50,
        },
      }),
    });

    if (!predResponse.ok) {
      const errText = await predResponse.text();
      console.error("Replicate error:", predResponse.status, errText);
      return new Response(JSON.stringify({ error: "Interior design service error" }), {
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
      return new Response(JSON.stringify({ error: "Interior design timed out or failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userIsAdmin) {
      await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "Interior Design",
      });
    } else {
      console.log("Admin free access - skipping credit deduction for Interior Design");
    }

    const outputUrl = typeof prediction.output === "string" ? prediction.output : prediction.output?.[0] || prediction.output;

    return new Response(JSON.stringify({ success: true, imageUrl: outputUrl, creditsUsed: userIsAdmin ? 0 : creditCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Interior design error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
