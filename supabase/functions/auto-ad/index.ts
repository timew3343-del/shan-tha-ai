import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Safe base64 encoding for large buffers (fixes "Maximum call stack size exceeded")
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let result = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    result += String.fromCharCode(...chunk);
  }
  return btoa(result);
}

// AI model failover list
const AI_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
];

async function callAIWithFailover(apiKey: string, messages: any[]): Promise<any> {
  let lastError = "";
  for (const model of AI_MODELS) {
    try {
      console.log(`Auto-Ad AI trying: ${model}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`Auto-Ad AI success: ${model}`);
          try { return JSON.parse(content); } catch { return { voiceover: content, scenes: [], cta: "Shop Now" }; }
        }
      }
      const errText = await response.text();
      lastError = `${model}: ${response.status}`;
      console.warn(`Auto-Ad AI ${lastError} - ${errText.substring(0, 100)}`);
    } catch (err: any) {
      lastError = `${model}: ${err.message}`;
      console.warn(`Auto-Ad AI error: ${lastError}`);
    }
  }
  return { voiceover: "", scenes: [], cta: "Shop Now" };
}

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
    const { images, productDetails, language, resolution, platforms, adStyle, showSubtitles } = await req.json();

    if (!images?.length || !productDetails) {
      return new Response(JSON.stringify({ error: "Images and product details required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Auto Ad: user=${userId}, images=${images.length}, platforms=${platforms.join(",")}, lang=${language}, res=${resolution}`);

    // Calculate credit cost
    const { data: marginSettings } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["profit_margin", "auto_ad_profit_margin"]);
    const marginMap: Record<string, string> = {};
    marginSettings?.forEach((s: any) => { marginMap[s.key] = s.value || ""; });

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
    apiKeySettings?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });

    const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Generate ad script with AI failover
    console.log("Step 1: Generating ad script...");

    const langMap: Record<string, string> = { my: "Myanmar (Burmese)", en: "English", th: "Thai" };
    const langName = langMap[language] || "Myanmar (Burmese)";

    const adScript = await callAIWithFailover(LOVABLE_API_KEY, [
      {
        role: "system",
        content: `You are a world-class advertising producer. Create a professional 30-second video ad script in ${langName}.
        Include: voiceover narration, scene descriptions for ${images.length} product images, background music suggestion, call-to-action.
        Return JSON: { "voiceover": "full narration text", "scenes": [{"description": "scene desc", "duration_seconds": 3}], "cta": "call to action", "music_mood": "upbeat/calm/dramatic" }`,
      },
      { role: "user", content: `Product: ${productDetails}. Number of product images: ${images.length}` },
    ]);

    console.log("Ad script generated");

    // Step 2: Enhance first image with Stability AI
    console.log("Step 2: Enhancing product images...");
    let enhancedImageBase64: string | null = null;

    if (STABILITY_API_KEY && images.length > 0) {
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
          // Use chunked base64 encoding to avoid stack overflow
          enhancedImageBase64 = arrayBufferToBase64(resultBuffer);
          console.log("Hero image enhanced successfully");
        } else {
          const errText = await enhanceResponse.text();
          console.warn("Image enhancement failed:", enhanceResponse.status, errText.substring(0, 100));
        }
      } catch (enhErr) {
        console.error("Image enhancement error:", enhErr);
      }
    }

    // Step 3: Generate video for each platform using Shotstack
    console.log("Step 3: Generating videos via Shotstack...");
    const resultVideos: { platform: string; url: string }[] = [];
    const SHOTSTACK_KEY = Deno.env.get("SHOTSTACK_API_KEY");

    for (const platform of platforms) {
      try {
        // Upload product image to storage for Shotstack access
        let productImageUrl = "";
        const imageToUse = enhancedImageBase64 || images[0];
        if (imageToUse) {
          let rawBase64 = imageToUse;
          if (rawBase64.includes(",")) rawBase64 = rawBase64.split(",")[1];
          const imgBytes = Uint8Array.from(atob(rawBase64), (c) => c.charCodeAt(0));
          const imgFileName = `ad-img-${userId}-${Date.now()}.png`;
          await supabaseAdmin.storage.from("videos").upload(imgFileName, imgBytes.buffer, { contentType: "image/png" });
          const { data: imgSigned } = await supabaseAdmin.storage.from("videos").createSignedUrl(imgFileName, 86400 * 7);
          productImageUrl = imgSigned?.signedUrl || "";
        }

        if (!productImageUrl) {
          console.warn(`No product image for ${platform}, skipping`);
          continue;
        }

        // Generate additional scene images with Stability AI
        const sceneImages: string[] = [productImageUrl];
        if (STABILITY_API_KEY) {
          const scenePrompts = [
            `Professional product showcase, ${adStyle} style, ${language === "my" ? "Myanmar" : "international"} advertising, cinematic lighting, 16:9`,
            `Call to action scene, ${adStyle} style, modern advertisement ending, brand logo placement area, 16:9`,
          ];
          for (const prompt of scenePrompts) {
            try {
              const fd = new FormData();
              fd.append("prompt", prompt);
              fd.append("output_format", "png");
              fd.append("aspect_ratio", "16:9");
              const sceneResp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
                method: "POST",
                headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
                body: fd,
              });
              if (sceneResp.ok) {
                const sceneBuffer = await sceneResp.arrayBuffer();
                const sceneBase64 = arrayBufferToBase64(sceneBuffer);
                const sceneBytes = Uint8Array.from(atob(sceneBase64), (c) => c.charCodeAt(0));
                const sceneFileName = `ad-scene-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
                await supabaseAdmin.storage.from("videos").upload(sceneFileName, sceneBytes.buffer, { contentType: "image/png" });
                const { data: sceneSigned } = await supabaseAdmin.storage.from("videos").createSignedUrl(sceneFileName, 86400 * 7);
                if (sceneSigned?.signedUrl) sceneImages.push(sceneSigned.signedUrl);
                console.log(`Ad scene image generated for ${platform}`);
              } else {
                await sceneResp.text();
              }
            } catch (e) {
              console.warn("Scene generation error:", e);
            }
          }
        }

        if (!SHOTSTACK_KEY) {
          console.error("Shotstack API key not configured");
          continue;
        }

        // Determine aspect ratio from platform
        const aspectMap: Record<string, string> = { youtube: "16:9", fb_tiktok: "9:16", square: "1:1" };
        const aspectRatio = aspectMap[platform] || "16:9";

        // Build Shotstack timeline
        const sceneDuration = 5;
        const clips = sceneImages.map((url, i) => ({
          asset: { type: "image", src: url },
          start: i * sceneDuration,
          length: sceneDuration,
          fit: "cover",
          transition: i > 0 ? { in: "fade" } : undefined,
          effect: "zoomIn",
        }));

        // Add CTA text overlay
        const ctaText = adScript?.cta || "Shop Now!";
        const totalDuration = sceneImages.length * sceneDuration;
        const textClips = [{
          asset: {
            type: "html",
            html: `<p style="font-family:sans-serif;font-size:36px;color:white;text-shadow:3px 3px 6px black;text-align:center;padding:20px;font-weight:bold;">${ctaText}</p>`,
            width: 800, height: 120,
          },
          start: totalDuration - sceneDuration,
          length: sceneDuration,
          position: "bottom",
          offset: { y: 0.1 },
          transition: { in: "fade" },
        }];

        // Add voiceover subtitle if enabled
        if (showSubtitles && adScript?.voiceover) {
          const voLines = adScript.voiceover.split(/[.!?။]/).filter((l: string) => l.trim());
          const lineDur = totalDuration / Math.max(voLines.length, 1);
          voLines.forEach((line: string, i: number) => {
            textClips.push({
              asset: {
                type: "html",
                html: `<p style="font-family:sans-serif;font-size:24px;color:white;text-shadow:2px 2px 4px black;text-align:center;padding:10px;">${line.trim()}</p>`,
                width: 800, height: 80,
              },
              start: i * lineDur,
              length: lineDur,
              position: "bottom",
              offset: { y: 0.02 },
              transition: { in: "fade", out: "fade" },
            });
          });
        }

        const shotstackPayload = {
          timeline: {
            background: "#000000",
            tracks: [
              { clips: textClips },
              { clips },
            ],
          },
          output: { format: "mp4", resolution: "hd", aspectRatio },
        };

        console.log(`Sending to Shotstack for ${platform}...`);
        const renderResp = await fetch("https://api.shotstack.io/v1/render", {
          method: "POST",
          headers: { "x-api-key": SHOTSTACK_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(shotstackPayload),
        });

        if (!renderResp.ok) {
          const errText = await renderResp.text();
          console.error(`Shotstack render error for ${platform}:`, renderResp.status, errText.substring(0, 200));
          continue;
        }

        const renderData = await renderResp.json();
        const renderId = renderData.response?.id;
        if (!renderId) { console.error("No render ID from Shotstack"); continue; }
        console.log(`Shotstack render started for ${platform}: ${renderId}`);

        // Poll for completion
        for (let i = 0; i < 36; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const checkResp = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
            headers: { "x-api-key": SHOTSTACK_KEY },
          });
          const checkData = await checkResp.json();
          const status = checkData.response?.status;
          console.log(`Shotstack poll ${platform} ${i}: ${status}`);

          if (status === "done") {
            const renderUrl = checkData.response?.url;
            if (renderUrl) {
              // Download and upload to storage
              const videoResp = await fetch(renderUrl);
              const videoBuffer = await videoResp.arrayBuffer();
              console.log(`Downloaded ${videoBuffer.byteLength} bytes for ${platform}`);
              const fileName = `auto-ad-${platform}-${userId}-${Date.now()}.mp4`;
              await supabaseAdmin.storage.from("videos").upload(fileName, videoBuffer, { contentType: "video/mp4" });
              const { data: signedData } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
              const videoUrl = signedData?.signedUrl || "";
              resultVideos.push({ platform, url: videoUrl });
              console.log(`Video for ${platform} completed`);
            }
            break;
          } else if (status === "failed") {
            console.error(`Shotstack render failed for ${platform}:`, checkData.response?.error);
            break;
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
      user_id: userId, amount: -creditCost, credit_type: "deduction",
      description: `Auto Ad: ${platforms.join(",")} ${language}`,
    });

    // Save outputs to user_outputs (server-side)
    const platformLabels: Record<string, string> = { youtube: "YouTube (16:9)", fb_tiktok: "FB/TikTok (9:16)", square: "Square (1:1)" };
    for (const vid of resultVideos) {
      if (vid.url) {
        await supabaseAdmin.from("user_outputs").insert({
          user_id: userId,
          tool_id: "auto_ad",
          tool_name: "Auto ကြော်ငြာ",
          output_type: "video",
          content: `Auto ကြော်ငြာ - ${platformLabels[vid.platform] || vid.platform}`,
          file_url: vid.url,
        });
      }
    }
    console.log(`Auto Ad completed, ${resultVideos.length} videos saved to store`);

    return new Response(JSON.stringify({
      videos: resultVideos,
      script: adScript,
      creditsUsed: creditCost,
      newBalance: (deductResult as any)?.new_balance,
      savedToStore: true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Auto Ad error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
