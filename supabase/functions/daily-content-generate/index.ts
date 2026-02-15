import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_NAME = "Myanmar AI Studio";
const WEBSITE_URL = "https://shan-tha-ai.lovable.app";

const PLATFORM_FEATURES = [
  "AI ပုံထုပ်ရန် (Image Generation)",
  "AI ဗီဒီယို ထုတ်ရန် (Video Generation)",
  "Background ဖယ်ရန် (BG Remove)",
  "4K Upscale လုပ်ရန်",
  "AI သီချင်း MTV ဖန်တီးရန်",
  "Face Swap လုပ်ရန်",
  "Logo Design ဖန်တီးရန်",
  "Interior Design ဖန်တီးရန်",
  "Virtual Try-On အကျီလဲဝတ်ကြည့်ရန်",
  "Auto Ad ကြော်ငြာ ဖန်တီးရန်",
  "AI Chat Bot သုံးရန်",
  "Photo Restore ဓာတ်ပုံပြင်ရန်",
  "Speech to Text အသံကို စာပြောင်းရန်",
  "Text to Speech စာကို အသံပြောင်းရန်",
  "CV Builder လုပ်ရန်",
  "Story to Video ဇာတ်လမ်းကို ဗီဒီယိုပြောင်းရန်",
  "Social Media Manager သုံးရန်",
  "Caption ထည့်ရန်",
  "BG Studio နောက်ခံပြောင်းရန်",
  "Exterior Design အိမ်ပြင်ပ ဒီဇိုင်းရန်",
];

const MARKETING_TOPICS = [
  `${PLATFORM_NAME} - လူတိုင်းအတွက် AI နည်းပညာ`,
  `သင့်လုပ်ငန်းကို AI နဲ့ တိုးတက်အောင်လုပ်ပါ - ${PLATFORM_NAME}`,
  `AI ပုံထုပ်ခြင်း - Professional ပုံများ တစ်စက္ကန့်အတွင်း`,
  `AI Video - ဗီဒီယို ဖန်တီးရာတွင် AI ကူညီပေးမည်`,
  `AI Logo Design - သင့်လုပ်ငန်း Brand ကို AI ဖန်တီးပေးမည်`,
  `Social Media Content - AI နဲ့ အလိုအလျောက် ဖန်တီးပါ`,
  `AI Interior Design - အိမ်ဒီဇိုင်းကို AI နဲ့ မြင်ကြည့်ပါ`,
  `AI Face Swap & Virtual Try-On - ဖက်ရှင်ကို AI နဲ့`,
];

const SLIDE_COLORS = ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560", "#1b1b2f", "#162447", "#1f4068"];

// Logo URL for watermark overlay
const LOGO_URL = "https://shan-tha-ai.lovable.app/favicon.png";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Shotstack API key
    const { data: shotstackSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "shotstack_api_key").single();
    const SHOTSTACK_API_KEY = shotstackSetting?.value || Deno.env.get("SHOTSTACK_API_KEY");
    if (!SHOTSTACK_API_KEY) {
      return new Response(JSON.stringify({ error: "Shotstack API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get OpenAI key for high-quality Burmese TTS
    const { data: openaiKeySetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "openai_api_key").maybeSingle();
    const OPENAI_API_KEY = openaiKeySetting?.value;

    // Load configs
    const { data: settings } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", [
        "content_factory_marketing_enabled", "content_factory_burmese_tutorial_enabled",
        "content_factory_english_tutorial_enabled", "content_factory_marketing_duration",
        "content_factory_burmese_duration", "content_factory_english_duration",
        "content_factory_marketing_topic", "content_factory_burmese_topic", "content_factory_english_topic",
      ]);

    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });

    const marketingEnabled = configMap["content_factory_marketing_enabled"] !== "false";
    const burmeseEnabled = configMap["content_factory_burmese_tutorial_enabled"] !== "false";
    const englishEnabled = configMap["content_factory_english_tutorial_enabled"] !== "false";

    const customMarketingTopic = configMap["content_factory_marketing_topic"] || "";
    const customBurmeseTopic = configMap["content_factory_burmese_topic"] || "";
    const customEnglishTopic = configMap["content_factory_english_topic"] || "";

    const marketingDuration = parseInt(configMap["content_factory_marketing_duration"] || "60");
    const burmeseDuration = parseInt(configMap["content_factory_burmese_duration"] || "120");
    const englishDuration = parseInt(configMap["content_factory_english_duration"] || "120");

    const today = new Date().toISOString().split("T")[0];
    const { data: existingToday } = await supabaseAdmin
      .from("daily_content_videos").select("video_type").eq("generated_date", today);
    const existingTypes = new Set(existingToday?.map((v: any) => v.video_type) || []);
    const results: any[] = [];

    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const featureIndex = dayOfYear % PLATFORM_FEATURES.length;
    const todayFeature = PLATFORM_FEATURES[featureIndex];
    const defaultMarketingTopic = MARKETING_TOPICS[dayOfYear % MARKETING_TOPICS.length];

    const marketingTopic = customMarketingTopic || defaultMarketingTopic;
    const burmeseTopic = customBurmeseTopic || `${todayFeature} - မြန်မာဘာသာ Tutorial`;
    const englishTopic = customEnglishTopic || `${todayFeature} - English Tutorial`;

    const videoConfigs = [
      { type: "marketing", enabled: marketingEnabled, topic: marketingTopic, duration: marketingDuration, published: false, lang: "my" },
      { type: "burmese_tutorial", enabled: burmeseEnabled, topic: burmeseTopic, duration: burmeseDuration, published: true, lang: "my" },
      { type: "english_tutorial", enabled: englishEnabled, topic: englishTopic, duration: englishDuration, published: true, lang: "en" },
    ];

    for (const vc of videoConfigs) {
      if (!vc.enabled || existingTypes.has(vc.type)) continue;

      try {
        console.log(`Generating ${vc.type} script...`);
        const scriptResult = await generateScript(LOVABLE_API_KEY, vc.type, vc.topic);

        const { data: record, error: insertErr } = await supabaseAdmin.from("daily_content_videos").insert({
          video_type: vc.type, title: scriptResult.title,
          description: scriptResult.description, facebook_caption: scriptResult.facebookCaption,
          hashtags: scriptResult.hashtags, generated_date: today,
          duration_seconds: vc.duration, api_cost_credits: 2, is_published: vc.published,
        }).select().single();
        if (insertErr) throw insertErr;

        console.log(`Rendering ${vc.type} video with Shotstack (9:16 portrait)...`);
        try {
          // Generate TTS audio
          let ttsAudioUrl: string | null = null;
          if (vc.lang === "en") {
            ttsAudioUrl = await generateTTS(SHOTSTACK_API_KEY, scriptResult.narration || scriptResult.description, "en-US", "Matthew");
          } else if (vc.lang === "my" && OPENAI_API_KEY) {
            // Use OpenAI TTS-1-HD for Burmese (high quality, natural sounding)
            ttsAudioUrl = await generateOpenAITTS(OPENAI_API_KEY, supabaseAdmin, scriptResult.narration || scriptResult.description);
          }

          const videoUrl = await renderPortraitVideo(SHOTSTACK_API_KEY, scriptResult, vc.duration, vc.type, ttsAudioUrl);

          if (videoUrl) {
            await supabaseAdmin.from("daily_content_videos")
              .update({ video_url: videoUrl, api_cost_credits: 4 }).eq("id", record.id);
            console.log(`${vc.type} video rendered: ${videoUrl}`);
            results.push({ type: vc.type, success: true, id: record.id, video_url: videoUrl });
          } else {
            results.push({ type: vc.type, success: true, id: record.id, video_url: null, note: "Script saved, video pending" });
          }
        } catch (renderErr) {
          console.error(`Render failed for ${vc.type}:`, renderErr);
          results.push({ type: vc.type, success: true, id: record.id, video_url: null, note: `Script saved, render failed: ${renderErr}` });
        }
      } catch (e) {
        console.error(`${vc.type} generation failed:`, e);
        results.push({ type: vc.type, success: false, error: String(e) });
      }
    }

    // Clear custom topics after use
    for (const t of [
      { key: "content_factory_marketing_topic", had: !!customMarketingTopic },
      { key: "content_factory_burmese_topic", had: !!customBurmeseTopic },
      { key: "content_factory_english_topic", had: !!customEnglishTopic },
    ]) {
      if (t.had) await supabaseAdmin.from("app_settings").upsert({ key: t.key, value: "" }, { onConflict: "key" });
    }

    return new Response(
      JSON.stringify({ success: true, date: today, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Daily content generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ==================== OPENAI TTS FOR BURMESE ====================

async function generateOpenAITTS(
  openaiKey: string, supabaseAdmin: any, text: string
): Promise<string | null> {
  try {
    const normalizedText = text.trim().normalize("NFC").substring(0, 3000);
    console.log(`Generating Burmese TTS via OpenAI TTS-1-HD, len=${normalizedText.length}`);

    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input: normalizedText,
        voice: "nova",
        response_format: "mp3",
      }),
    });

    if (!ttsResponse.ok) {
      console.warn(`OpenAI TTS failed: ${ttsResponse.status}`);
      return null;
    }

    // Upload to Supabase storage for Shotstack to access
    const audioBuffer = await ttsResponse.arrayBuffer();
    const fileName = `tts-${Date.now()}.mp3`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("user-outputs")
      .upload(`tts/${fileName}`, audioBuffer, { contentType: "audio/mpeg", upsert: true });

    if (uploadErr) {
      console.warn("TTS upload error:", uploadErr);
      return null;
    }

    // Create a signed URL (1 hour expiry) since bucket is private
    const { data: signedData, error: signedErr } = await supabaseAdmin.storage
      .from("user-outputs")
      .createSignedUrl(`tts/${fileName}`, 3600);

    if (signedErr || !signedData?.signedUrl) {
      console.warn("TTS signed URL error:", signedErr);
      return null;
    }

    console.log(`Burmese TTS uploaded with signed URL`);
    return signedData.signedUrl;
  } catch (e) {
    console.warn("OpenAI TTS error:", e);
    return null;
  }
}

// ==================== SHOTSTACK TTS GENERATION ====================

async function generateTTS(
  apiKey: string, text: string, language: string, voice: string
): Promise<string | null> {
  try {
    // Truncate text to ~500 chars for TTS
    const ttsText = text.substring(0, 500).replace(/\n/g, ". ");

    const res = await fetch("https://api.shotstack.io/create/stage/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        provider: "shotstack",
        options: { type: "text-to-speech", text: ttsText, voice, language },
      }),
    });

    if (!res.ok) {
      console.warn(`TTS creation failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const assetId = data?.data?.id;
    if (!assetId) return null;

    // Poll for TTS completion (max 60s)
    const maxWait = 60000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.shotstack.io/create/stage/assets/${assetId}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      const status = statusData?.data?.attributes?.status;
      if (status === "done") {
        const url = statusData?.data?.attributes?.url;
        console.log(`TTS audio ready: ${url}`);
        return url;
      }
      if (status === "failed") {
        console.warn("TTS generation failed");
        return null;
      }
    }
    console.warn("TTS timed out");
    return null;
  } catch (e) {
    console.warn("TTS error:", e);
    return null;
  }
}

// ==================== PORTRAIT VIDEO RENDERING (9:16) ====================

async function renderPortraitVideo(
  apiKey: string, script: ScriptResult, durationSec: number,
  videoType: string, ttsAudioUrl: string | null
): Promise<string | null> {
  const tracks = buildPortraitSlides(script, durationSec, videoType, ttsAudioUrl);

  const editPayload = {
    timeline: {
      background: "#000000",
      fonts: [
        { src: "https://templates.shotstack.io/basic/asset/font/opensans-regular.ttf" },
        { src: "https://cdn.jsdelivr.net/gh/nicholasgasior/gfonts@master/dist/NotoSansMyanmar-Regular.ttf" },
      ],
      tracks,
    },
    output: {
      format: "mp4",
      resolution: "sd",
      aspectRatio: "9:16",
      fps: 25,
    },
  };

  console.log("Submitting Shotstack 9:16 portrait render...");
  const renderRes = await fetch("https://api.shotstack.io/edit/stage/render", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(editPayload),
  });

  if (!renderRes.ok) {
    const errText = await renderRes.text();
    throw new Error(`Shotstack render failed: ${renderRes.status} - ${errText}`);
  }

  const renderData = await renderRes.json();
  const renderId = renderData?.response?.id;
  if (!renderId) throw new Error("No render ID");

  console.log(`Render submitted: ${renderId}`);

  // Poll (max 5 min)
  const maxWait = 300000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 10000));
    const statusRes = await fetch(`https://api.shotstack.io/edit/stage/render/${renderId}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    const status = statusData?.response?.status;
    console.log(`Render status: ${status}`);
    if (status === "done") return statusData.response.url;
    if (status === "failed") throw new Error(`Render failed: ${JSON.stringify(statusData.response.error)}`);
  }
  console.warn("Render timed out");
  return null;
}

function buildPortraitSlides(
  script: ScriptResult, totalDuration: number, videoType: string, ttsAudioUrl: string | null
) {
  const steps = script.steps || [];
  const paragraphs = steps.length > 0 ? steps : script.description.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);

  const slideCount = Math.min(paragraphs.length + 1, 10);
  const slideDuration = Math.max(totalDuration / slideCount, 4);

  const titleColor = videoType === "marketing" ? "#e94560" : videoType === "burmese_tutorial" ? "#FFD700" : "#00BFFF";
  const accentColor = videoType === "marketing" ? "#ff6b8a" : videoType === "burmese_tutorial" ? "#FFE066" : "#66D9FF";

  const slideClips: any[] = [];

  // Title slide with branding
  slideClips.push({
    asset: {
      type: "html",
      html: `<div style="font-family: 'Noto Sans Myanmar', 'Open Sans', sans-serif; text-align: center; padding: 30px 20px; color: white; display: flex; flex-direction: column; justify-content: center; height: 100%;">
        <div style="font-size: 16px; color: ${accentColor}; margin-bottom: 12px; letter-spacing: 2px;">✦ ${PLATFORM_NAME} ✦</div>
        <h1 style="font-size: 28px; margin: 16px 0; color: ${titleColor}; line-height: 1.5;">${escapeHtml(script.title)}</h1>
        <p style="font-size: 14px; opacity: 0.7; margin-top: 12px;">${WEBSITE_URL}</p>
        <div style="margin-top: 20px; font-size: 13px; color: ${accentColor};">▶ ${videoType === "marketing" ? "ကြော်ငြာ" : "Tutorial"}</div>
      </div>`,
      width: 576,
      height: 1024,
      background: SLIDE_COLORS[0],
    },
    start: 0,
    length: slideDuration,
    transition: { in: "fade", out: "fade" },
  });

  // Content slides - step-by-step tutorial style
  const contentItems = paragraphs.slice(0, 9);
  contentItems.forEach((text, i) => {
    const truncated = text.length > 180 ? text.substring(0, 177) + "..." : text;
    const bgColor = SLIDE_COLORS[(i + 1) % SLIDE_COLORS.length];
    const stepNum = i + 1;

    slideClips.push({
      asset: {
        type: "html",
      html: `<div style="font-family: 'Noto Sans Myanmar', 'Open Sans', sans-serif; text-align: center; padding: 30px 20px; color: white; display: flex; flex-direction: column; justify-content: center; height: 100%;">
          <div style="font-size: 42px; color: ${titleColor}; margin-bottom: 16px; font-weight: bold;">Step ${stepNum}</div>
          <p style="font-size: 20px; line-height: 1.8; padding: 0 10px;">${escapeHtml(truncated)}</p>
          <div style="margin-top: 20px; font-size: 11px; opacity: 0.5;">${PLATFORM_NAME}</div>
        </div>`,
        width: 576,
        height: 1024,
        background: bgColor,
      },
      start: slideDuration * (i + 1),
      length: slideDuration,
      transition: { in: "slideRight", out: "fade" },
    });
  });

  const tracks: any[] = [{ clips: slideClips }];

  // Logo watermark overlay - positioned on the right side
  const totalLen = slideDuration * slideCount;
  tracks.push({
    clips: [{
      asset: {
        type: "image",
        src: LOGO_URL,
      },
      start: 0,
      length: totalLen,
      position: "topRight",
      offset: { x: -0.03, y: 0.02 },
      scale: 0.12,
      opacity: 0.7,
    }],
  });

  // TTS audio track (if available)
  if (ttsAudioUrl) {
    tracks.push({
      clips: [{
        asset: { type: "audio", src: ttsAudioUrl },
        start: 0,
        length: totalLen,
      }],
    });
  }

  return tracks;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==================== AI SCRIPT GENERATION ====================

interface ScriptResult {
  title: string;
  description: string;
  steps: string[];
  narration: string;
  facebookCaption: string;
  hashtags: string[];
}

async function generateScript(
  apiKey: string, videoType: string, topic: string
): Promise<ScriptResult> {
  const isEnglish = videoType === "english_tutorial";
  const isMarketing = videoType === "marketing";

  const systemPrompt = isMarketing
    ? `You are a marketing copywriter for "${PLATFORM_NAME}" (website: ${WEBSITE_URL}).
       Generate a compelling marketing script in Burmese (Myanmar language).
       The script should show step-by-step how to use the platform.
       Write as if you are guiding someone through the website screen by screen.
       Example: "ပထမဆုံး ${WEBSITE_URL} ကိုသွားပါ" "Sign Up ကိုနှိပ်ပါ" etc.`
    : videoType === "burmese_tutorial"
    ? `You are a tutorial creator for "${PLATFORM_NAME}" (website: ${WEBSITE_URL}).
       Create a step-by-step tutorial in Burmese (Myanmar language).
       Write each step as a screen instruction: "ဒီ button ကိုနှိပ်ပါ", "ဒီနေရာမှာ ရိုက်ထည့်ပါ" etc.
       Start from opening the website, signing in, then using the specific tool.
       Make it very practical - every step should be an action the user takes on screen.`
    : `You are a tutorial creator for "${PLATFORM_NAME}" (website: ${WEBSITE_URL}).
       Create a step-by-step tutorial in English.
       Write each step as a screen instruction: "Click the Sign Up button", "Type your prompt here" etc.
       Start from opening the website, signing in, then using the specific tool.
       Make it very practical - every step should be an action the user takes on screen.`;

  const userPrompt = `Create content for: ${topic}

Return a JSON object with these fields:
- title: Short title (max 50 chars)
- description: Overview paragraph (100-200 words)
- steps: Array of 5-8 step-by-step instructions (each step is 1-2 sentences, written as screen actions like "Click X", "Go to Y", "Enter Z")
- narration: ${isEnglish ? "English voiceover script (200-400 words) narrating all steps naturally" : "Burmese voiceover text (200-400 words)"}
- facebookCaption: Facebook caption with emojis (100-200 chars)
- hashtags: Array of 5-8 hashtags (without #)

Return ONLY valid JSON, no markdown.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title || topic,
    description: parsed.description || "",
    steps: parsed.steps || [],
    narration: parsed.narration || parsed.description || "",
    facebookCaption: parsed.facebookCaption || parsed.facebook_caption || "",
    hashtags: parsed.hashtags || [],
  };
}
