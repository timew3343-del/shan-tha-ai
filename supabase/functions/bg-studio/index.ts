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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;
    const { imageBase64, backgroundPrompt, backgroundId } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Image is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;
    console.log(`BG Studio: user=${userId}, bg=${backgroundId}, isAdmin=${userIsAdmin}`);

    // Get credit cost from admin settings
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_bg_studio").maybeSingle();
    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      creditCost = Math.ceil(2 * (1 + profitMargin / 100));
    }

    // Admin bypass + Check balance
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!userIsAdmin && (!profile || profile.credit_balance < creditCost)) {
      return new Response(JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get API keys
    const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["replicate_api_token", "stability_api_key"]);
    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k) => { keyMap[k.key] = k.value || ""; });

    const REPLICATE_API_KEY = keyMap.replicate_api_token || Deno.env.get("REPLICATE_API_KEY");
    const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");

    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "API not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Remove background using Replicate
    console.log("Step 1: Removing background...");

    const bgRemoveResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Token ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        input: { image: `data:image/png;base64,${imageBase64}` },
      }),
    });

    if (!bgRemoveResponse.ok) {
      const errText = await bgRemoveResponse.text();
      console.error("BG remove error:", errText);
      throw new Error("Background removal failed");
    }

    const prediction = await bgRemoveResponse.json();
    let result = prediction;
    for (let i = 0; i < 30 && result.status !== "succeeded" && result.status !== "failed"; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });
      result = await poll.json();
    }

    if (result.status !== "succeeded") throw new Error("Background removal timed out");

    const noBgImageUrl = result.output;
    console.log("Background removed successfully");

    // Step 2: Create new background with Stability AI
    let finalImage = noBgImageUrl;

    if (STABILITY_API_KEY) {
      console.log("Step 2: Creating new background...");
      try {
        // Download the no-bg image
        const noBgResponse = await fetch(noBgImageUrl);
        const noBgBuffer = await noBgResponse.arrayBuffer();
        const noBgBlob = new Blob([noBgBuffer], { type: "image/png" });

        const formData = new FormData();
        formData.append("image", noBgBlob, "product.png");
        formData.append("prompt", `${backgroundPrompt}. Place the product naturally on this background with professional studio lighting and shadows.`);
        formData.append("search_prompt", "transparent background, empty space");
        formData.append("output_format", "png");

        const stabilityResponse = await fetch("https://api.stability.ai/v2beta/stable-image/edit/search-and-replace", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
          body: formData,
        });

        if (stabilityResponse.ok) {
          const resultBuffer = await stabilityResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(resultBuffer)));
          finalImage = `data:image/png;base64,${base64}`;
          console.log("New background applied successfully");
        } else {
          console.error("Stability AI error:", await stabilityResponse.text());
        }
      } catch (bgError) {
        console.error("Background replacement error:", bgError);
      }
    }

    // Deduct credits after success (skip for admin)
    let newBalance = profile?.credit_balance || 0;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "bg_studio",
      });
      newBalance = deductResult?.new_balance ?? 0;
      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId, amount: creditCost, credit_type: "deduction", description: `BG Studio: ${backgroundId}`,
      });
    } else {
      console.log("Admin free access - skipping credit deduction for BG Studio");
    }

    // Save output to user_outputs
    try {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: userId, tool_id: "bg_studio", tool_name: "BG Studio",
        output_type: "image", file_url: finalImage,
      });
    } catch (e) { console.warn("Failed to save BG Studio output:", e); }

    return new Response(JSON.stringify({
      image: finalImage,
      creditsUsed: userIsAdmin ? 0 : creditCost,
      newBalance,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("BG Studio error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
