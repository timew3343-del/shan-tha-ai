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
    const { images, productDetails, language, resolution, platforms } = await req.json();

    if (!images?.length || !productDetails) {
      return new Response(JSON.stringify({ error: "Images and product details required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Auto Ad: user=${userId}, images=${images.length}, platforms=${platforms.join(",")}, lang=${language}, res=${resolution}`);

    // Calculate credit cost with auto_ad specific profit margin
    const { data: marginSettings } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["profit_margin", "auto_ad_profit_margin"]);
    const marginMap: Record<string, string> = {};
    marginSettings?.forEach((s) => { marginMap[s.key] = s.value || ""; });

    const profitMargin = marginMap.auto_ad_profit_margin
      ? parseInt(marginMap.auto_ad_profit_margin, 10)
      : marginMap.profit_margin
        ? parseInt(marginMap.profit_margin, 10)
        : 50;

    const BASE_COST = 18;
    const perPlatformCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    const creditCost = perPlatformCost * platforms.length;

    // Check balance
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile || profile.credit_balance < creditCost) {
      return new Response(JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get API keys
    const { data: apiKeySettings } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["stability_api_key", "shotstack_api_key"]);
    const keyMap: Record<string, string> = {};
    apiKeySettings?.forEach((k) => { keyMap[k.key] = k.value || ""; });

    const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SHOTSTACK_API_KEY = keyMap.shotstack_api_key;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Generate ad script with Gemini
    console.log("Step 1: Generating ad script...");

    const langMap: Record<string, string> = { my: "Myanmar (Burmese)", en: "English", th: "Thai" };
    const langName = langMap[language] || "Myanmar (Burmese)";

    const scriptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a world-class advertising producer. Create a professional 30-second video ad script in ${langName}.
            Include: voiceover narration, scene descriptions for ${images.length} product images, background music suggestion, call-to-action.
            Return JSON: { "voiceover": "full narration text", "scenes": [{"description": "scene desc", "duration_seconds": 3}], "cta": "call to action", "music_mood": "upbeat/calm/dramatic" }`,
          },
          { role: "user", content: `Product: ${productDetails}. Number of product images: ${images.length}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    let adScript: any = {};
    if (scriptResponse.ok) {
      const scriptData = await scriptResponse.json();
      try {
        adScript = JSON.parse(scriptData.choices?.[0]?.message?.content || "{}");
      } catch {
        adScript = { voiceover: productDetails, scenes: [], cta: "Shop Now" };
      }
      console.log("Ad script generated");
    }

    // Step 2: Enhance first image with Stability AI
    console.log("Step 2: Enhancing product images...");
    const enhancedImages: string[] = [];

    if (STABILITY_API_KEY && images.length > 0) {
      // Enhance first image as hero
      try {
        const imgBytes = Uint8Array.from(atob(images[0]), (c) => c.charCodeAt(0));
        const imgBlob = new Blob([imgBytes], { type: "image/png" });

        const formData = new FormData();
        formData.append("image", imgBlob, "product.png");
        formData.append("prompt", "Professional advertising product photography, studio lighting, premium background, commercial quality");
        formData.append("search_prompt", "background");
        formData.append("output_format", "png");

        const enhanceResponse = await fetch("https://api.stability.ai/v2beta/stable-image/edit/search-and-replace", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
          body: formData,
        });

        if (enhanceResponse.ok) {
          const resultBuffer = await enhanceResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(resultBuffer)));
          enhancedImages.push(`data:image/png;base64,${base64}`);
          console.log("Hero image enhanced");
        }
      } catch (enhErr) {
        console.error("Image enhancement error:", enhErr);
      }
    }

    // Step 3: Generate video for each platform
    console.log("Step 3: Generating videos...");
    const resultVideos: { platform: string; url: string }[] = [];

    for (const platform of platforms) {
      try {
        // Use Stability AI to generate a video clip from enhanced image
        if (STABILITY_API_KEY && enhancedImages.length > 0) {
          let videoImageData = enhancedImages[0];
          if (videoImageData.includes(",")) videoImageData = videoImageData.split(",")[1];
          const videoImageBytes = Uint8Array.from(atob(videoImageData), (c) => c.charCodeAt(0));

          const videoFormData = new FormData();
          videoFormData.append("image", new Blob([videoImageBytes], { type: "image/png" }), "image.png");
          videoFormData.append("motion_bucket_id", "180");
          videoFormData.append("cfg_scale", "2.0");

          const startResponse = await fetch("https://api.stability.ai/v2beta/image-to-video", {
            method: "POST",
            headers: { Authorization: `Bearer ${STABILITY_API_KEY}` },
            body: videoFormData,
          });

          if (startResponse.ok) {
            const startData = await startResponse.json();
            const genId = startData.id;
            console.log(`Video generation for ${platform}: ${genId}`);

            for (let i = 0; i < 36; i++) {
              await new Promise(r => setTimeout(r, 5000));
              const checkResponse = await fetch(`https://api.stability.ai/v2beta/image-to-video/result/${genId}`, {
                headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "video/*" },
              });

              if (checkResponse.status === 200) {
                const videoBuffer = await checkResponse.arrayBuffer();
                const fileName = `auto-ad-${platform}-${userId}-${Date.now()}.mp4`;
                await supabaseAdmin.storage.from("videos").upload(fileName, videoBuffer, { contentType: "video/mp4" });
                const { data: signedData, error: signedErr } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400);
                resultVideos.push({ platform, url: signedErr ? "" : signedData?.signedUrl || "" });
                console.log(`Video for ${platform} completed`);
                break;
              } else if (checkResponse.status !== 202) {
                console.error(`Video ${platform} error:`, checkResponse.status);
                break;
              }
            }
          }
        }
      } catch (vidErr) {
        console.error(`Video ${platform} error:`, vidErr);
      }
    }

    // Deduct credits after success
    const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId, _amount: creditCost, _action: "auto_ad",
    });

    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId, amount: creditCost, credit_type: "deduction",
      description: `Auto Ad: ${platforms.join(",")} ${language} ${resolution}`,
    });

    console.log("Auto Ad completed");

    return new Response(JSON.stringify({
      videos: resultVideos,
      script: adScript,
      creditsUsed: creditCost,
      newBalance: deductResult?.new_balance,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Auto Ad error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
