import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  "AI Tools Platform - လူတိုင်းအတွက် AI နည်းပညာ",
  "သင့်လုပ်ငန်းကို AI နဲ့ တိုးတက်အောင်လုပ်ပါ",
  "AI ပုံထုပ်ခြင်း - Professional ပုံများ တစ်စက္ကန့်အတွင်း",
  "AI Video - ဗီဒီယို ဖန်တီးရာတွင် AI ကူညီပေးမည်",
  "AI Logo Design - သင့်လုပ်ငန်း Brand ကို AI ဖန်တီးပေးမည်",
  "Social Media Content - AI နဲ့ အလိုအလျောက် ဖန်တီးပါ",
  "AI Interior Design - အိမ်ဒီဇိုင်းကို AI နဲ့ မြင်ကြည့်ပါ",
  "AI Face Swap & Virtual Try-On - ဖက်ရှင်ကို AI နဲ့",
];

// Background colors for slides
const SLIDE_COLORS = ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560", "#1b1b2f", "#162447", "#1f4068"];

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

    // Get Shotstack API key from app_settings
    const { data: shotstackSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "shotstack_api_key")
      .single();

    const SHOTSTACK_API_KEY = shotstackSetting?.value || Deno.env.get("SHOTSTACK_API_KEY");
    if (!SHOTSTACK_API_KEY) {
      console.error("Shotstack API key not found");
      return new Response(JSON.stringify({ error: "Shotstack API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load configs
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "content_factory_marketing_enabled",
        "content_factory_burmese_tutorial_enabled",
        "content_factory_english_tutorial_enabled",
        "content_factory_marketing_duration",
        "content_factory_burmese_duration",
        "content_factory_english_duration",
        "content_factory_marketing_topic",
        "content_factory_burmese_topic",
        "content_factory_english_topic",
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
      .from("daily_content_videos")
      .select("video_type")
      .eq("generated_date", today);

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
      { type: "marketing", enabled: marketingEnabled, topic: marketingTopic, duration: marketingDuration, published: false },
      { type: "burmese_tutorial", enabled: burmeseEnabled, topic: burmeseTopic, duration: burmeseDuration, published: true },
      { type: "english_tutorial", enabled: englishEnabled, topic: englishTopic, duration: englishDuration, published: true },
    ];

    for (const vc of videoConfigs) {
      if (!vc.enabled || existingTypes.has(vc.type)) continue;

      try {
        console.log(`Generating ${vc.type} script...`);
        const scriptResult = await generateScript(LOVABLE_API_KEY, vc.type, vc.topic);

        // Insert record first (pending video)
        const { data: record, error: insertErr } = await supabaseAdmin.from("daily_content_videos").insert({
          video_type: vc.type,
          title: scriptResult.title,
          description: scriptResult.description,
          facebook_caption: scriptResult.facebookCaption,
          hashtags: scriptResult.hashtags,
          generated_date: today,
          duration_seconds: vc.duration,
          api_cost_credits: 2,
          is_published: vc.published,
        }).select().single();

        if (insertErr) throw insertErr;

        // Now render video with Shotstack
        console.log(`Rendering ${vc.type} video with Shotstack...`);
        try {
          const videoUrl = await renderWithShotstack(
            SHOTSTACK_API_KEY,
            scriptResult,
            vc.duration,
            vc.type
          );

          if (videoUrl) {
            // Update record with video URL
            await supabaseAdmin.from("daily_content_videos")
              .update({ video_url: videoUrl, api_cost_credits: 4 })
              .eq("id", record.id);

            console.log(`${vc.type} video rendered: ${videoUrl}`);
            results.push({ type: vc.type, success: true, id: record.id, video_url: videoUrl });
          } else {
            console.warn(`${vc.type} video rendering returned no URL`);
            results.push({ type: vc.type, success: true, id: record.id, video_url: null, note: "Script saved, video pending" });
          }
        } catch (renderErr) {
          console.error(`Shotstack render failed for ${vc.type}:`, renderErr);
          results.push({ type: vc.type, success: true, id: record.id, video_url: null, note: `Script saved, render failed: ${renderErr}` });
        }
      } catch (e) {
        console.error(`${vc.type} generation failed:`, e);
        results.push({ type: vc.type, success: false, error: String(e) });
      }
    }

    // Clear custom topics after use
    const topicsToClean = [
      { key: "content_factory_marketing_topic", hadCustom: !!customMarketingTopic },
      { key: "content_factory_burmese_topic", hadCustom: !!customBurmeseTopic },
      { key: "content_factory_english_topic", hadCustom: !!customEnglishTopic },
    ];
    for (const t of topicsToClean) {
      if (t.hadCustom) {
        await supabaseAdmin.from("app_settings")
          .upsert({ key: t.key, value: "" }, { onConflict: "key" });
      }
    }

    console.log(`Daily content generation complete. Results: ${JSON.stringify(results)}`);

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

// ==================== SHOTSTACK VIDEO RENDERING ====================

async function renderWithShotstack(
  apiKey: string,
  script: ScriptResult,
  durationSec: number,
  videoType: string
): Promise<string | null> {
  // Build a text-slide video using Shotstack Edit API
  const slides = buildSlides(script, durationSec, videoType);
  
  const timeline = {
    background: "#000000",
    fonts: [
      { src: "https://templates.shotstack.io/basic/asset/font/opensans-regular.ttf" },
    ],
    tracks: slides,
  };

  const editPayload = {
    timeline,
    output: {
      format: "mp4",
      resolution: "sd",
      fps: 25,
    },
  };

  console.log("Submitting Shotstack render...");

  // Submit render
  const renderRes = await fetch("https://api.shotstack.io/edit/stage/render", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(editPayload),
  });

  if (!renderRes.ok) {
    const errText = await renderRes.text();
    throw new Error(`Shotstack render submit failed: ${renderRes.status} - ${errText}`);
  }

  const renderData = await renderRes.json();
  const renderId = renderData?.response?.id;
  if (!renderId) throw new Error("No render ID returned from Shotstack");

  console.log(`Shotstack render submitted: ${renderId}`);

  // Poll for completion (max 5 minutes)
  const maxWait = 300000;
  const pollInterval = 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval));

    const statusRes = await fetch(`https://api.shotstack.io/edit/stage/render/${renderId}`, {
      headers: { "x-api-key": apiKey },
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.warn(`Shotstack status check failed: ${statusRes.status} - ${errText}`);
      continue;
    }

    const statusData = await statusRes.json();
    const status = statusData?.response?.status;
    console.log(`Shotstack render status: ${status}`);

    if (status === "done") {
      return statusData.response.url;
    } else if (status === "failed") {
      throw new Error(`Shotstack render failed: ${JSON.stringify(statusData.response.error)}`);
    }
    // Otherwise keep polling (queued, fetching, rendering, saving)
  }

  console.warn("Shotstack render timed out after 5 minutes");
  return null;
}

function buildSlides(script: ScriptResult, totalDuration: number, videoType: string) {
  // Split description into paragraphs for slides
  const paragraphs = script.description
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Create slides: title slide + content slides
  const slideCount = Math.min(paragraphs.length + 1, 8); // max 8 slides
  const slideDuration = Math.max(totalDuration / slideCount, 3);

  const titleColor = videoType === "marketing" ? "#e94560" : videoType === "burmese_tutorial" ? "#533483" : "#0f3460";

  const clips: any[] = [];

  // Title slide
  clips.push({
    asset: {
      type: "html",
      html: `<div style="font-family: 'Open Sans'; text-align: center; padding: 40px; color: white;">
        <h1 style="font-size: 42px; margin-bottom: 20px; color: ${titleColor};">${escapeHtml(script.title)}</h1>
        <p style="font-size: 20px; opacity: 0.8;">Shan Tha AI</p>
      </div>`,
      width: 1024,
      height: 576,
      background: SLIDE_COLORS[0],
    },
    start: 0,
    length: slideDuration,
    transition: { in: "fade", out: "fade" },
  });

  // Content slides
  const contentParagraphs = paragraphs.slice(0, 7);
  contentParagraphs.forEach((text, i) => {
    const truncatedText = text.length > 200 ? text.substring(0, 197) + "..." : text;
    const bgColor = SLIDE_COLORS[(i + 1) % SLIDE_COLORS.length];

    clips.push({
      asset: {
        type: "html",
        html: `<div style="font-family: 'Open Sans'; text-align: center; padding: 40px; color: white;">
          <p style="font-size: 26px; line-height: 1.6;">${escapeHtml(truncatedText)}</p>
        </div>`,
        width: 1024,
        height: 576,
        background: bgColor,
      },
      start: slideDuration * (i + 1),
      length: slideDuration,
      transition: { in: "fade", out: "fade" },
    });
  });

  return [{ clips }];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================== AI SCRIPT GENERATION ====================

interface ScriptResult {
  title: string;
  description: string;
  facebookCaption: string;
  hashtags: string[];
}

async function generateScript(
  apiKey: string,
  videoType: string,
  topic: string
): Promise<ScriptResult> {
  const systemPrompt =
    videoType === "marketing"
      ? `You are a marketing copywriter for an AI tools platform called "Shan Tha AI". 
         Generate a compelling marketing script in Burmese (Myanmar language) for social media.
         The script should be catchy, engaging, and highlight the AI tool's benefits.
         Include step-by-step instructions that could be turned into a video tutorial.`
      : videoType === "burmese_tutorial"
      ? `You are a tutorial content creator for "Shan Tha AI" platform.
         Create a detailed step-by-step tutorial script in Burmese (Myanmar language).
         Start from account creation/login, then demonstrate each step with clear instructions.
         The tutorial should be practical and easy to follow for beginners.`
      : `You are a tutorial content creator for "Shan Tha AI" platform.
         Create a detailed step-by-step tutorial script in English.
         Start from account creation/login, then demonstrate each step with clear instructions.
         The tutorial should be practical and easy to follow for beginners.`;

  const userPrompt = `Create content for: ${topic}

Return a JSON object with these fields:
- title: Short title (max 60 chars)
- description: Detailed video script/description (300-600 words) with step-by-step instructions. Split into short paragraphs (each 1-2 sentences) for video slides. Include clear numbered steps.
- facebookCaption: Ready-to-post Facebook caption with emojis (100-200 chars)
- hashtags: Array of 5-8 relevant hashtags (without #)

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
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title || topic,
    description: parsed.description || "",
    facebookCaption: parsed.facebookCaption || parsed.facebook_caption || "",
    hashtags: parsed.hashtags || [],
  };
}
