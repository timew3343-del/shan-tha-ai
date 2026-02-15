import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function processOneImage(imageBase64: string, replicateKey: string): Promise<string | null> {
  const imageDataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  const predResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${replicateKey}`, "Content-Type": "application/json" },
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
    console.error("Replicate create error:", predResponse.status, await predResponse.text());
    return null;
  }

  let prediction = await predResponse.json();
  let waited = 0;
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && waited < 120) {
    await new Promise(r => setTimeout(r, 3000));
    waited += 3;
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${replicateKey}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== "succeeded") return null;
  return typeof prediction.output === "string" ? prediction.output : prediction.output?.[0] || null;
}

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

    // Support both legacy single-image and new bulk mode
    const imageList: string[] = body.images || (body.imageBase64 ? [body.imageBase64] : []);
    if (imageList.length === 0) {
      return new Response(JSON.stringify({ error: "At least one image is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (imageList.length > 10) {
      return new Response(JSON.stringify({ error: "Maximum 10 images allowed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    // Credit check
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_photo_restoration").maybeSingle();
    const creditCostPerImage = costSetting?.value ? parseInt(costSetting.value, 10) : 10;
    const totalCost = creditCostPerImage * imageList.length;

    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!userIsAdmin && (!profile || profile.credit_balance < totalCost)) {
      return new Response(JSON.stringify({ error: "Insufficient credits", required: totalCost }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "Replicate API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Photo restore for user ${userId}: ${imageList.length} images, cost=${totalCost}`);

    // Process all images in parallel
    const results = await Promise.all(
      imageList.map(img => processOneImage(img, REPLICATE_API_KEY))
    );

    const successfulResults = results.filter((r): r is string => r !== null);

    if (successfulResults.length === 0) {
      return new Response(JSON.stringify({ error: "All photo restorations failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credits only for successful restorations (skip for admin)
    const actualCost = creditCostPerImage * successfulResults.length;
    if (!userIsAdmin) {
      await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: actualCost, _action: `Photo Restoration (${successfulResults.length} images)`,
      });
    } else {
      console.log("Admin free access - skipping credit deduction for Photo Restoration");
    }

    // Legacy single-image response format compatibility
    if (body.imageBase64 && !body.images) {
      return new Response(JSON.stringify({ 
        success: true, 
        imageUrl: successfulResults[0], 
        creditsUsed: actualCost 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results: successfulResults, 
      creditsUsed: actualCost,
      totalProcessed: successfulResults.length,
      totalRequested: imageList.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Photo restore error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
