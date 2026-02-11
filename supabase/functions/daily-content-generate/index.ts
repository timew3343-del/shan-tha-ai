import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform features to rotate through for tutorials
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
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      ]);

    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });

    const marketingEnabled = configMap["content_factory_marketing_enabled"] !== "false";
    const burmeseEnabled = configMap["content_factory_burmese_tutorial_enabled"] !== "false";
    const englishEnabled = configMap["content_factory_english_tutorial_enabled"] !== "false";

    const today = new Date().toISOString().split("T")[0];

    // Check what's already generated today
    const { data: existingToday } = await supabaseAdmin
      .from("daily_content_videos")
      .select("video_type")
      .eq("generated_date", today);

    const existingTypes = new Set(existingToday?.map((v: any) => v.video_type) || []);
    const results: any[] = [];

    // Determine which feature to teach today (rotate by day of year)
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const featureIndex = dayOfYear % PLATFORM_FEATURES.length;
    const todayFeature = PLATFORM_FEATURES[featureIndex];
    const marketingTopic = MARKETING_TOPICS[dayOfYear % MARKETING_TOPICS.length];

    // Generate Marketing Ad
    if (marketingEnabled && !existingTypes.has("marketing")) {
      try {
        const scriptResult = await generateScript(LOVABLE_API_KEY, "marketing", marketingTopic);
        const record = await supabaseAdmin.from("daily_content_videos").insert({
          video_type: "marketing",
          title: scriptResult.title,
          description: scriptResult.description,
          facebook_caption: scriptResult.facebookCaption,
          hashtags: scriptResult.hashtags,
          generated_date: today,
          api_cost_credits: 2,
          is_published: false,
        }).select().single();
        results.push({ type: "marketing", success: true, id: record.data?.id });
        console.log("Marketing ad script generated successfully");
      } catch (e) {
        console.error("Marketing generation failed:", e);
        results.push({ type: "marketing", success: false, error: String(e) });
      }
    }

    // Generate Burmese Tutorial
    if (burmeseEnabled && !existingTypes.has("burmese_tutorial")) {
      try {
        const scriptResult = await generateScript(
          LOVABLE_API_KEY,
          "burmese_tutorial",
          `${todayFeature} - မြန်မာဘာသာ Tutorial`
        );
        const record = await supabaseAdmin.from("daily_content_videos").insert({
          video_type: "burmese_tutorial",
          title: scriptResult.title,
          description: scriptResult.description,
          facebook_caption: scriptResult.facebookCaption,
          hashtags: scriptResult.hashtags,
          generated_date: today,
          api_cost_credits: 2,
          is_published: true,
        }).select().single();
        results.push({ type: "burmese_tutorial", success: true, id: record.data?.id });
        console.log("Burmese tutorial script generated successfully");
      } catch (e) {
        console.error("Burmese tutorial generation failed:", e);
        results.push({ type: "burmese_tutorial", success: false, error: String(e) });
      }
    }

    // Generate English Tutorial
    if (englishEnabled && !existingTypes.has("english_tutorial")) {
      try {
        const scriptResult = await generateScript(
          LOVABLE_API_KEY,
          "english_tutorial",
          `${todayFeature} - English Tutorial`
        );
        const record = await supabaseAdmin.from("daily_content_videos").insert({
          video_type: "english_tutorial",
          title: scriptResult.title,
          description: scriptResult.description,
          facebook_caption: scriptResult.facebookCaption,
          hashtags: scriptResult.hashtags,
          generated_date: today,
          api_cost_credits: 2,
          is_published: true,
        }).select().single();
        results.push({ type: "english_tutorial", success: true, id: record.data?.id });
        console.log("English tutorial script generated successfully");
      } catch (e) {
        console.error("English tutorial generation failed:", e);
        results.push({ type: "english_tutorial", success: false, error: String(e) });
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

async function generateScript(
  apiKey: string,
  videoType: string,
  topic: string
): Promise<{
  title: string;
  description: string;
  facebookCaption: string;
  hashtags: string[];
}> {
  const systemPrompt =
    videoType === "marketing"
      ? `You are a marketing copywriter for an AI tools platform called "Shan Tha AI". 
         Generate a compelling marketing script in Burmese (Myanmar language) for social media.
         The script should be catchy, engaging, and highlight the AI tool's benefits.`
      : videoType === "burmese_tutorial"
      ? `You are a tutorial content creator for "Shan Tha AI" platform.
         Create a step-by-step tutorial script in Burmese (Myanmar language).
         The tutorial should be easy to follow and practical.`
      : `You are a tutorial content creator for "Shan Tha AI" platform.
         Create a step-by-step tutorial script in English.
         The tutorial should be easy to follow and practical.`;

  const userPrompt = `Create content for: ${topic}

Return a JSON object with these fields:
- title: Short title (max 60 chars)
- description: Detailed script/description (200-400 words)
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

  // Parse JSON from response
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
