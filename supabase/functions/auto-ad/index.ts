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

// Fetch OpenAI key dynamically from app_settings
async function getOpenAIKey(supabaseAdmin: any): Promise<string | null> {
  const { data: settings } = await supabaseAdmin
    .from("app_settings").select("key, value")
    .in("key", ["openai_api_key", "api_enabled_openai"]);
  const configMap: Record<string, string> = {};
  settings?.forEach((s: any) => { configMap[s.key] = s.value; });
  if (configMap["api_enabled_openai"] === "false") return null;
  return configMap["openai_api_key"] || null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function estimateVoiceoverSeconds(text: string, language: string): number {
  const content = text.trim();
  if (!content) return 8;

  const charCount = content.replace(/\s+/g, "").length;
  const words = content.split(/\s+/).filter(Boolean).length;
  const rateByLanguage: Record<string, number> = {
    my: 7.5,
    th: 10,
    en: 2.35,
  };

  const estimated = language === "en"
    ? words / rateByLanguage.en
    : charCount / (rateByLanguage[language] || 8);

  return Math.max(8, Math.ceil(estimated));
}

function buildCaptionLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((block) => block.split(/[။!?]+/))
    .map((line) => line.replace(/^[\-•\d.\s]+/, "").trim())
    .filter(Boolean)
    .map((line) => line.length > 68
      ? line.match(/.{1,34}(?:\s|$)/g)?.map((part) => part.trim()).filter(Boolean) ?? [line]
      : [line]
    )
    .flat();
}

function splitVoiceoverToCaptions(
  text: string,
  totalDurationSec: number,
  preferredCaptions?: string[],
): Array<{ text: string; start: number; length: number }> {
  const lines = (preferredCaptions?.length ? preferredCaptions : buildCaptionLines(text)).filter(Boolean);

  if (lines.length === 0) return [];

  const baseLength = totalDurationSec / lines.length;
  return lines.map((line, index) => ({
    text: line,
    start: Number((index * baseLength).toFixed(2)),
    length: Number(Math.max(3, baseLength).toFixed(2)),
  }));
}

async function uploadBytesToSignedUrl(
  supabaseAdmin: any,
  fileName: string,
  bytes: ArrayBuffer,
  contentType: string,
  expiresIn = 86400 * 7,
): Promise<string> {
  await supabaseAdmin.storage.from("videos").upload(fileName, bytes, { contentType, upsert: true });
  const { data } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, expiresIn);
  return data?.signedUrl || "";
}

function normalizeAdScriptResponse(raw: any, fallbackLanguage: string) {
  const scenes = Array.isArray(raw?.scenes) ? raw.scenes : [];
  const subtitleLines = Array.isArray(raw?.subtitle_lines)
    ? raw.subtitle_lines.map((line: unknown) => String(line || "").trim()).filter(Boolean)
    : [];

  return {
    language: raw?.language || fallbackLanguage,
    voiceover: String(raw?.voiceover || "").trim(),
    scenes,
    cta: String(raw?.cta || "Shop Now").trim(),
    music_mood: String(raw?.music_mood || "uplifting cinematic").trim(),
    subtitle_lines: subtitleLines,
  };
}

async function callAIWithFailover(
  supabaseAdmin: any,
  lovableKey: string,
  messages: any[],
  fallbackLanguage: string,
): Promise<any> {
  const openaiKey = await getOpenAIKey(supabaseAdmin);
  if (openaiKey) {
    try {
      console.log("Auto-Ad AI: trying OpenAI GPT-4o (primary)");
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", messages, response_format: { type: "json_object" }, temperature: 0.55, max_tokens: 2200 }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log("Auto-Ad AI: success with OpenAI GPT-4o");
          try { return normalizeAdScriptResponse(JSON.parse(content), fallbackLanguage); } catch { return normalizeAdScriptResponse({ voiceover: content }, fallbackLanguage); }
        }
      } else {
        const errText = await resp.text();
        console.warn(`OpenAI failed: ${resp.status} - ${errText.substring(0, 100)}`);
      }
    } catch (err: any) {
      console.warn(`OpenAI error: ${err.message}`);
    }
  }

  const fallbackModels = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
  for (const model of fallbackModels) {
    try {
      console.log(`Auto-Ad AI fallback: ${model}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.55, max_tokens: 2200 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`Auto-Ad AI: success with ${model}`);
          try { return normalizeAdScriptResponse(JSON.parse(content), fallbackLanguage); } catch { return normalizeAdScriptResponse({ voiceover: content }, fallbackLanguage); }
        }
      }
      const errText = await response.text();
      console.warn(`${model}: ${response.status} - ${errText.substring(0, 100)}`);
    } catch (err: any) {
      console.warn(`${model} error: ${err.message}`);
    }
  }
  return normalizeAdScriptResponse({ voiceover: "", scenes: [], cta: "Shop Now" }, fallbackLanguage);
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

    // Check admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    const { images, productDetails, language, resolution, platforms, adStyle, showSubtitles, videoDurationMinutes } = await req.json();
    const requestedDurationMin = Math.min(Math.max(videoDurationMinutes || 1, 1), 10);

    if (!images?.length || !productDetails) {
      return new Response(JSON.stringify({ error: "Images and product details required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Auto Ad: user=${userId}, images=${images.length}, platforms=${platforms.join(",")}, lang=${language}, duration=${requestedDurationMin}min`);

    // Get credit cost from admin settings
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_auto_ad").maybeSingle();
    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10) * platforms.length * requestedDurationMin;
    } else {
      const { data: marginSettings } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["profit_margin", "auto_ad_profit_margin"]);
      const marginMap: Record<string, string> = {};
      marginSettings?.forEach((s: any) => { marginMap[s.key] = s.value || ""; });
      const profitMargin = marginMap.auto_ad_profit_margin ? parseInt(marginMap.auto_ad_profit_margin, 10) : marginMap.profit_margin ? parseInt(marginMap.profit_margin, 10) : 50;
      const BASE_COST = 18;
      const perPlatformCost = Math.ceil(BASE_COST * (1 + profitMargin / 100) * requestedDurationMin);
      creditCost = perPlatformCost * platforms.length;
    }

    // Admin bypass + Check balance
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!userIsAdmin && (!profile || profile.credit_balance < creditCost)) {
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
    const requestedTimelineDuration = requestedDurationMin * 60;
    const targetSceneCount = Math.max(images.length * 2, Math.min(16, requestedDurationMin * 4));

    const adScript = await callAIWithFailover(supabaseAdmin, LOVABLE_API_KEY, [
      {
        role: "system",
        content: `You are a world-class advertising producer.
Create the ad ONLY in ${langName}. Never switch languages. If the requested language is Myanmar, every line of voiceover, CTA, and subtitles must be fully in Myanmar Unicode script.
Match the script length to about ${requestedTimelineDuration} seconds of spoken narration.
If product details are short, expand only with safe marketing structure: hook, problem, benefits, usage, trust points, CTA. Do not invent fake medical or legal claims.
If product details are too long for the chosen duration, compress to only the strongest selling points.
Return strict JSON with this shape:
{
  "language": "${language}",
  "voiceover": "full narration in ${langName}",
  "subtitle_lines": ["short subtitle line 1", "short subtitle line 2"],
  "scenes": [{"description": "visual direction matching uploaded product images", "duration_seconds": 4}],
  "cta": "short CTA in ${langName}",
  "music_mood": "clear music direction such as uplifting cinematic pop"
}`,
      },
      {
        role: "user",
        content: `Selected language: ${language} (${langName})
Requested duration: ${requestedDurationMin} minutes (${requestedTimelineDuration} seconds)
Uploaded images: ${images.length}
Target scene count: ${targetSceneCount}
Product details:\n${productDetails}`,
      },
    ], language);

    console.log("Ad script generated");

    // Step 2: Prepare visual + audio assets for each platform
    console.log("Step 2: Preparing ad assets...");
    const resultVideos: { platform: string; url: string }[] = [];
    const SHOTSTACK_KEY = keyMap.shotstack_api_key || Deno.env.get("SHOTSTACK_API_KEY");
    const openaiKey = await getOpenAIKey(supabaseAdmin);

    let enhancedImageBase64: string | null = null;
    if (STABILITY_API_KEY && images.length > 0) {
      try {
        const imgBytes = Uint8Array.from(atob(images[0]), (c) => c.charCodeAt(0));
        const imgBlob = new Blob([imgBytes], { type: "image/png" });
        const formData = new FormData();
        formData.append("image", imgBlob, "product.png");
        formData.append("prompt", `Professional product photography for a ${adStyle} ${langName} advertisement, premium commercial composition, luxury lighting, polished textures`);
        formData.append("search_prompt", "background");
        formData.append("output_format", "png");

        const enhanceResponse = await fetch("https://api.stability.ai/v2beta/stable-image/edit/search-and-replace", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
          body: formData,
        });

        if (enhanceResponse.ok) {
          enhancedImageBase64 = arrayBufferToBase64(await enhanceResponse.arrayBuffer());
          console.log("Hero image enhanced successfully");
        }
      } catch (enhErr) {
        console.error("Image enhancement error:", enhErr);
      }
    }

    let voiceoverUrl = "";
    if (adScript?.voiceover && openaiKey) {
      try {
        const voiceMap: Record<string, string> = {
          my: "nova",
          en: "alloy",
          th: "shimmer",
        };
        const ttsResp = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1-hd",
            voice: voiceMap[language] || "nova",
            input: adScript.voiceover,
            format: "mp3",
          }),
        });

        if (ttsResp.ok) {
          const audioBuffer = await ttsResp.arrayBuffer();
          voiceoverUrl = await uploadBytesToSignedUrl(
            supabaseAdmin,
            `${userId}/auto-ad-voiceover-${Date.now()}.mp3`,
            audioBuffer,
            "audio/mpeg",
          );
          console.log("Voiceover audio generated");
        } else {
          console.warn("Voiceover generation failed", ttsResp.status);
        }
      } catch (ttsErr) {
        console.error("Voiceover generation error:", ttsErr);
      }
    }

    for (const platform of platforms) {
      try {
        const aspectMap: Record<string, string> = { youtube: "16:9", fb_tiktok: "9:16", square: "1:1" };
        const aspectRatio = aspectMap[platform] || "16:9";

        const heroImageBase64 = enhancedImageBase64 || images[0];
        const uploadedImageUrls: string[] = [];
        for (let i = 0; i < images.length; i++) {
          const sourceImage = i === 0 ? heroImageBase64 : images[i];
          const raw = sourceImage?.includes(",") ? sourceImage.split(",")[1] : sourceImage;
          if (!raw) continue;
          const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
          const imgUrl = await uploadBytesToSignedUrl(
            supabaseAdmin,
            `${userId}/auto-ad-img-${platform}-${Date.now()}-${i}.png`,
            bytes.buffer,
            "image/png",
          );
          if (imgUrl) uploadedImageUrls.push(imgUrl);
        }

        if (uploadedImageUrls.length === 0) {
          console.warn(`No product image for ${platform}, skipping`);
          continue;
        }

        const scenePrompts = Array.isArray(adScript?.scenes) ? adScript.scenes : [];
        const estimatedVoiceoverDuration = adScript?.voiceover
          ? estimateVoiceoverSeconds(adScript.voiceover, language)
          : requestedTimelineDuration;
        const totalTimelineDuration = Math.max(requestedTimelineDuration, estimatedVoiceoverDuration);
        const perPlatformSceneCount = Math.max(uploadedImageUrls.length * 2, Math.min(16, requestedDurationMin * 4));
        const sceneDuration = Number((totalTimelineDuration / perPlatformSceneCount).toFixed(2));
        const sceneImages: string[] = [];

        for (let si = 0; si < targetSceneCount; si++) {
          const sourceUrl = uploadedImageUrls[si % uploadedImageUrls.length];
          let finalSceneUrl = sourceUrl;

          if (STABILITY_API_KEY) {
            try {
              const scenePrompt = scenePrompts[si]?.description || `Premium ${adStyle} product advertisement scene featuring ${productDetails}, visually elegant commercial styling for ${langName}, polished lighting, rich background, high-end branding`;
              const fd = new FormData();
              fd.append("prompt", `${scenePrompt}. Keep the original product details consistent and make the composition beautiful, premium, and platform-ready.`);
              fd.append("output_format", "png");
              fd.append("aspect_ratio", aspectRatio);
              const sceneResp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
                method: "POST",
                headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
                body: fd,
              });
              if (sceneResp.ok) {
                const sceneUrl = await uploadBytesToSignedUrl(
                  supabaseAdmin,
                  `${userId}/auto-ad-scene-${platform}-${Date.now()}-${si}.png`,
                  await sceneResp.arrayBuffer(),
                  "image/png",
                );
                if (sceneUrl) finalSceneUrl = sceneUrl;
              }
            } catch (e) {
              console.warn("Scene generation error:", e);
            }
          }

          sceneImages.push(finalSceneUrl);
        }

        if (!SHOTSTACK_KEY) {
          console.error("Shotstack API key not configured");
          continue;
        }

        const myanmarFontLink = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;700&display=swap" rel="stylesheet">`;
        const clips = sceneImages.map((url, i) => ({
          asset: { type: "image", src: url },
          start: Number((i * sceneDuration).toFixed(2)),
          length: sceneDuration,
          fit: "cover",
          effect: ["zoomIn", "zoomOut", "slideLeft", "slideRight", "slideUp"][i % 5],
          transition: i > 0 ? { in: "fade" } : undefined,
        }));

        const captionClips = showSubtitles && adScript?.voiceover
          ? splitVoiceoverToCaptions(adScript.voiceover, totalTimelineDuration).map((caption) => ({
              asset: {
                type: "html",
                html: `${myanmarFontLink}<div style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;padding:0 24px;"><p style="font-family:'Noto Sans Myanmar',sans-serif;font-size:30px;font-weight:700;color:white;text-shadow:3px 3px 6px rgba(0,0,0,0.85);text-align:center;padding:12px 22px;background:rgba(0,0,0,0.45);border-radius:12px;line-height:1.45;">${escapeHtml(caption.text)}</p></div>`,
                width: 1100,
                height: 160,
              },
              start: caption.start,
              length: Math.min(caption.length, Math.max(totalTimelineDuration - caption.start, 0.5)),
              position: "bottom",
              offset: { y: 0.03 },
            }))
          : [];

        const ctaClip = {
          asset: {
            type: "html",
            html: `${myanmarFontLink}<div style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;padding:0 24px;"><p style="font-family:'Noto Sans Myanmar',sans-serif;font-size:36px;color:white;text-shadow:3px 3px 6px rgba(0,0,0,0.85);text-align:center;padding:20px 28px;background:rgba(0,0,0,0.38);border-radius:16px;font-weight:700;">${escapeHtml(adScript?.cta || "Shop Now!")}</p></div>`,
            width: 900,
            height: 140,
          },
          start: Math.max(totalTimelineDuration - Math.min(8, sceneDuration * 2), 0),
          length: Math.min(8, Math.max(sceneDuration * 2, 4)),
          position: "bottom",
          offset: { y: 0.09 },
        };

        const shotstackPayload = {
          timeline: {
            background: "#000000",
            soundtrack: voiceoverUrl ? { src: voiceoverUrl, volume: 1 } : undefined,
            tracks: [
              { clips },
              { clips: [...captionClips, ctaClip] },
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

    // Deduct credits after success (skip for admin)
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "auto_ad",
      });
      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId, amount: -creditCost, credit_type: "deduction",
        description: `Auto Ad: ${platforms.join(",")} ${language}`,
      });
    } else {
      console.log("Admin free access - skipping credit deduction for Auto Ad");
    }

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

    const { data: updatedProfile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    return new Response(JSON.stringify({
      videos: resultVideos,
      script: adScript,
      creditsUsed: userIsAdmin ? 0 : creditCost,
      newBalance: updatedProfile?.credit_balance ?? 0,
      savedToStore: true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Auto Ad error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
