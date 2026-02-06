import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AdRequest {
  productImageBase64: string;
  productDescription: string;
  adStyle: string; // "modern" | "minimal" | "bold" | "elegant"
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    const { productImageBase64, productDescription, adStyle }: AdRequest = await req.json();

    if (!productImageBase64 || !productDescription) {
      return new Response(
        JSON.stringify({ error: "Product image and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Ad generation request: user=${userId}, style=${adStyle}`);

    // Get credit cost
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "credit_cost_ad_generator")
      .maybeSingle();

    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 9;

    // Check balance
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (!profile) {
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

    // Get API keys
    const { data: apiKeys } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["stability_api_key"]);

    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k) => { keyMap[k.key] = k.value || ""; });

    const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!STABILITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Stability AI key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======== STEP 1: Generate Ad Script with Gemini ========
    console.log("Step 1: Generating ad script with Gemini...");

    const scriptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional advertising copywriter. Create compelling ad copy in both Myanmar and English. 
Style: ${adStyle}. 
Return JSON format: {"headline_my":"...","headline_en":"...","body_my":"...","body_en":"...","cta_my":"...","cta_en":"...","hashtags":["..."]}
Keep it concise and impactful. Headline max 10 words. Body max 30 words. CTA max 5 words.`,
          },
          {
            role: "user",
            content: `Product: ${productDescription}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    let adScript: any = {};
    if (scriptResponse.ok) {
      const scriptData = await scriptResponse.json();
      const content = scriptData.choices?.[0]?.message?.content;
      if (content) {
        try {
          adScript = JSON.parse(content);
        } catch {
          adScript = { headline_en: content, body_en: productDescription };
        }
      }
      console.log("Ad script generated successfully");
    } else {
      console.error("Gemini script error:", await scriptResponse.text());
      adScript = {
        headline_en: "Premium Quality Product",
        headline_my: "အရည်အသွေး မြင့်မားသော ထုတ်ကုန်",
        body_en: productDescription,
        body_my: productDescription,
        cta_en: "Shop Now",
        cta_my: "ယခု ဝယ်ယူမည်",
      };
    }

    // ======== STEP 2: Enhance Image with Stability AI ========
    console.log("Step 2: Enhancing product image with Stability AI...");

    // Extract base64 data (remove data URL prefix if present)
    let imageData = productImageBase64;
    if (imageData.includes(",")) {
      imageData = imageData.split(",")[1];
    }

    // Convert base64 to blob for Stability API
    const imageBytes = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
    const imageBlob = new Blob([imageBytes], { type: "image/png" });

    // Use Stability AI search-and-replace to enhance background
    const formData = new FormData();
    formData.append("image", imageBlob, "product.png");
    formData.append("prompt", `Professional ${adStyle} advertising background, studio lighting, commercial product photography, clean and modern`);
    formData.append("search_prompt", "background");
    formData.append("output_format", "png");

    let enhancedImageBase64 = productImageBase64;

    const stabilityResponse = await fetch(
      "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STABILITY_API_KEY}`,
          Accept: "image/*",
        },
        body: formData,
      }
    );

    if (stabilityResponse.ok) {
      const resultBuffer = await stabilityResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(resultBuffer)));
      enhancedImageBase64 = `data:image/png;base64,${base64}`;
      console.log("Image enhanced successfully");
    } else {
      const errText = await stabilityResponse.text();
      console.error("Stability AI error:", stabilityResponse.status, errText);
      // Continue with original image
      enhancedImageBase64 = productImageBase64;
    }

    // ======== STEP 3: Deduct credits ========
    const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Ad Generator",
    });

    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId,
      amount: -creditCost,
      credit_type: "ad_generation",
      description: `Ad: ${adStyle} style - ${productDescription.substring(0, 50)}`,
    });

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

    console.log(`Ad generated for user ${userId}. Credits used: ${creditCost}`);

    return new Response(
      JSON.stringify({
        success: true,
        adScript,
        enhancedImage: enhancedImageBase64,
        creditsUsed: creditCost,
        newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Ad generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
