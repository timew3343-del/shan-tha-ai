import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AdRequest {
  productImageBase64: string;
  productDescription: string;
  adStyle: string;
  duration: string;
  language: string;
  voiceGender: string;
}

// Duration multipliers for credit cost calculation
const DURATION_MULTIPLIERS: Record<string, number> = {
  "15s": 1, "30s": 1.5, "60s": 2, "2m": 3, "3m": 4, "4m": 5,
  "5m": 6, "6m": 7, "7m": 8, "8m": 9, "10m": 11, "15m": 15,
};

// Style-specific prompts for Gemini script and Stability AI image enhancement
const STYLE_CONFIG: Record<string, { scriptPrompt: string; imagePrompt: string }> = {
  cinematic: {
    scriptPrompt: "Create a cinematic, movie-trailer quality ad script. Use dramatic pauses, powerful narration, and emotional hooks. Think Hollywood-level storytelling.",
    imagePrompt: "Cinematic lighting, dramatic shadows, film grain texture, anamorphic lens flare, depth of field, movie-quality color grading, professional studio setup",
  },
  viral: {
    scriptPrompt: "Create a viral social media ad that instantly grabs attention. Use trending hooks, punchy one-liners, and FOMO-inducing language. Make it shareable and scroll-stopping.",
    imagePrompt: "Vibrant neon colors, trendy aesthetic, eye-catching contrast, bold typography space, social media optimized, modern pop culture vibes",
  },
  minimalist: {
    scriptPrompt: "Create a minimalist, elegant ad script. Use fewer words with maximum impact. Let silence and white space speak. Clean and sophisticated tone.",
    imagePrompt: "Clean white background, minimal shadows, soft diffused lighting, elegant negative space, premium product photography, Scandinavian design aesthetic",
  },
  testimonial: {
    scriptPrompt: "Create a testimonial-style ad script as if a real customer is sharing their experience. Use authentic, conversational language with specific details.",
    imagePrompt: "Warm natural lighting, cozy lifestyle setting, authentic feel, soft bokeh background, relatable environment, natural color palette",
  },
  storytelling: {
    scriptPrompt: "Create a narrative-driven ad with a compelling story arc: setup, conflict, and resolution featuring the product as the hero. Emotionally engaging.",
    imagePrompt: "Story-like atmosphere, warm golden hour lighting, narrative composition, emotional depth, artistic framing, editorial quality",
  },
  corporate: {
    scriptPrompt: "Create a professional, business-oriented ad script. Authoritative and trustworthy tone. Use data points, credibility markers, and clear value propositions.",
    imagePrompt: "Professional studio lighting, clean corporate background, sharp details, blue-grey tones, business environment, sleek modern aesthetic",
  },
  energetic: {
    scriptPrompt: "Create a high-energy, fast-paced ad script. Use short punchy sentences, exclamation marks, and action words. Build excitement and urgency.",
    imagePrompt: "Dynamic lighting, motion blur effects, vibrant saturated colors, energetic composition, action-packed atmosphere, explosive visual energy",
  },
  luxury: {
    scriptPrompt: "Create a premium luxury ad script. Exclusive and aspirational. Use sophisticated language, emphasize rarity, craftsmanship, and prestige.",
    imagePrompt: "Luxury gold and black tones, silk and velvet textures, marble surfaces, premium studio lighting, high-end fashion photography, opulent atmosphere",
  },
  bold: {
    scriptPrompt: "Create a bold, vibrant ad script. Strong statements, vivid language, and unapologetic confidence. Make a statement that can't be ignored.",
    imagePrompt: "Bold contrasting colors, dramatic composition, strong shadows, vivid saturation, powerful visual impact, geometric shapes and patterns",
  },
  modern: {
    scriptPrompt: "Create a modern, clean ad script. Contemporary tone, clear messaging. Balance between professional and approachable.",
    imagePrompt: "Modern clean design, soft gradient background, contemporary lighting, fresh and crisp colors, geometric minimalism, tech-forward aesthetic",
  },
  retro: {
    scriptPrompt: "Create a nostalgic retro-style ad script. Evoke vintage charm with classic advertising language. Warm and familiar tone.",
    imagePrompt: "Vintage film effect, warm retro color palette, analog texture overlay, 70s/80s aesthetic, nostalgic warm tones, classic composition",
  },
  playful: {
    scriptPrompt: "Create a fun, playful ad script. Use humor, puns, and lighthearted language. Make people smile and feel good.",
    imagePrompt: "Bright cheerful colors, playful composition, fun elements, candy-like palette, whimsical props, joyful atmosphere",
  },
  emotional: {
    scriptPrompt: "Create an emotionally touching ad script. Connect with heart and feelings. Use sensory language that creates a deep personal connection.",
    imagePrompt: "Warm emotional lighting, soft focus, intimate atmosphere, golden warm tones, heartfelt composition, gentle and touching aesthetic",
  },
  tech: {
    scriptPrompt: "Create a futuristic, tech-forward ad script. Use innovation language, cutting-edge terminology, and forward-thinking vision.",
    imagePrompt: "Futuristic neon glow, holographic effects, dark tech background, cyberpunk elements, digital particle effects, sci-fi lighting",
  },
  fashion: {
    scriptPrompt: "Create a stylish fashion/beauty ad script. Trendy, glamorous, and aspirational. Use fashion industry language and beauty terminology.",
    imagePrompt: "High-fashion lighting, glamorous composition, beauty photography style, editorial quality, runway aesthetic, sophisticated color grading",
  },
  food: {
    scriptPrompt: "Create a mouth-watering food & beverage ad script. Use sensory descriptors, taste language, and appetite-triggering words.",
    imagePrompt: "Appetizing food photography lighting, warm golden tones, fresh ingredients backdrop, steam and texture details, gourmet presentation",
  },
  realestate: {
    scriptPrompt: "Create a real estate showcase ad script. Highlight space, lifestyle, and investment value. Professional and aspirational.",
    imagePrompt: "Architectural photography lighting, wide angle perspective, luxury interior backdrop, natural light streaming, property showcase composition",
  },
  automotive: {
    scriptPrompt: "Create an automotive ad script. Emphasize power, performance, design, and driving experience. Exciting and aspirational.",
    imagePrompt: "Dynamic automotive lighting, reflective surfaces, speed-inspired composition, dramatic angles, sleek metallic environment, road and motion backdrop",
  },
  health: {
    scriptPrompt: "Create a health & wellness ad script. Fresh, natural, and empowering. Focus on vitality, well-being, and transformation.",
    imagePrompt: "Fresh natural lighting, green and clean tones, organic textures, wellness atmosphere, pure and healthy aesthetic, nature-inspired backdrop",
  },
  travel: {
    scriptPrompt: "Create a travel & adventure ad script. Evoke wanderlust, freedom, and discovery. Paint vivid pictures of destinations and experiences.",
    imagePrompt: "Epic landscape backdrop, adventure lighting, golden hour glow, travel-inspired composition, vast horizon, wanderlust aesthetic",
  },
};

// Language configuration
const LANGUAGE_CONFIG: Record<string, { name: string; scriptLang: string }> = {
  my: { name: "Myanmar", scriptLang: "Myanmar (Burmese)" },
  en: { name: "English", scriptLang: "English" },
  th: { name: "Thai", scriptLang: "Thai" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ===== AUTH =====
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // ===== PARSE INPUT =====
    const {
      productImageBase64,
      productDescription,
      adStyle = "cinematic",
      duration = "30s",
      language = "my",
      voiceGender = "female",
    }: AdRequest = await req.json();

    if (!productImageBase64 || !productDescription) {
      return new Response(
        JSON.stringify({ error: "Product image and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Ad generation: user=${userId}, style=${adStyle}, duration=${duration}, lang=${language}, voice=${voiceGender}`);

    // ===== CALCULATE CREDIT COST using global profit margin =====
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();

    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 6; // Base API cost for ad generator
    const baseCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    const multiplier = DURATION_MULTIPLIERS[duration] || 1;
    const creditCost = Math.ceil(baseCost * multiplier);

    // ===== CHECK BALANCE =====
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

    // ===== GET API KEYS =====
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

    // ===== GET STYLE CONFIG =====
    const styleConfig = STYLE_CONFIG[adStyle] || STYLE_CONFIG.cinematic;
    const langConfig = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.my;

    // ======== STEP 1: Generate Ad Script with Gemini ========
    console.log("Step 1: Generating ad script...");

    const durationLabel = duration.includes("m")
      ? `${duration.replace("m", "")} minute`
      : `${duration.replace("s", "")} second`;

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
            content: `You are a world-class advertising copywriter.
${styleConfig.scriptPrompt}

Create a ${durationLabel} ad script in ${langConfig.scriptLang}.
Also provide translations in the other languages from: Myanmar, English, Thai.

Voice: ${voiceGender === "male" ? "Strong, authoritative male voice" : "Warm, engaging female voice"}.

Return JSON format:
{
  "headline_my": "...",
  "headline_en": "...",
  "headline_th": "...",
  "body_my": "...",
  "body_en": "...",
  "body_th": "...",
  "cta_my": "...",
  "cta_en": "...",
  "cta_th": "...",
  "voiceover_script": "The full voiceover narration script in ${langConfig.scriptLang} for ${durationLabel}. This should be timed for natural speech at the selected duration.",
  "hashtags": ["relevant", "hashtags"]
}

Guidelines:
- Headline: max 10 words, impactful
- Body: descriptive, matched to the ${durationLabel} duration
- CTA: max 5 words, action-oriented
- Voiceover: Natural speech pacing for ${durationLabel}. Include pauses [pause] where needed.
- Hashtags: 5-8 relevant tags`,
          },
          {
            role: "user",
            content: `Product: ${productDescription}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    let adScript: Record<string, any> = {};
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
      const errText = await scriptResponse.text();
      console.error("Gemini script error:", scriptResponse.status, errText);
      adScript = {
        headline_en: "Premium Quality Product",
        headline_my: "အရည်အသွေး မြင့်မားသော ထုတ်ကုန်",
        body_en: productDescription,
        body_my: productDescription,
        cta_en: "Shop Now",
        cta_my: "ယခု ဝယ်ယူမည်",
        voiceover_script: productDescription,
      };
    }

    // ======== STEP 2: Enhance Image with Stability AI ========
    console.log("Step 2: Enhancing product image...");

    let imageData = productImageBase64;
    if (imageData.includes(",")) {
      imageData = imageData.split(",")[1];
    }

    const imageBytes = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
    const imageBlob = new Blob([imageBytes], { type: "image/png" });

    const formData = new FormData();
    formData.append("image", imageBlob, "product.png");
    formData.append("prompt", `Professional advertising background: ${styleConfig.imagePrompt}. Commercial product photography, high-end quality.`);
    formData.append("search_prompt", "background");
    formData.append("output_format", "png");

    let enhancedImageBase64 = productImageBase64;

    try {
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
        console.error("Stability AI image error:", stabilityResponse.status, errText);
      }
    } catch (imgError) {
      console.error("Image enhancement error:", imgError);
    }

    // ======== STEP 3: Generate Video from Enhanced Image ========
    console.log("Step 3: Generating video from enhanced image...");

    let videoData: string | null = null;

    try {
      // Get the enhanced image bytes for video generation
      let videoImageData = enhancedImageBase64;
      if (videoImageData.includes(",")) {
        videoImageData = videoImageData.split(",")[1];
      }
      const videoImageBytes = Uint8Array.from(atob(videoImageData), (c) => c.charCodeAt(0));

      const videoFormData = new FormData();
      videoFormData.append("image", new Blob([videoImageBytes], { type: "image/png" }), "image.png");
      videoFormData.append("motion_bucket_id", "127");
      videoFormData.append("cfg_scale", "1.8");

      const startResponse = await fetch("https://api.stability.ai/v2beta/image-to-video", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STABILITY_API_KEY}`,
        },
        body: videoFormData,
      });

      if (startResponse.ok) {
        const startData = await startResponse.json();
        const generationId = startData.id;

        if (generationId) {
          console.log(`Video generation started: ${generationId}`);

          // Poll for completion (max 3 minutes)
          const maxAttempts = 36;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const resultResponse = await fetch(
              `https://api.stability.ai/v2beta/image-to-video/result/${generationId}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${STABILITY_API_KEY}`,
                  Accept: "video/*",
                },
              }
            );

            if (resultResponse.status === 202) {
              console.log(`Video polling ${attempt + 1}/${maxAttempts}...`);
              continue;
            }

            if (resultResponse.status === 200) {
              const videoBuffer = await resultResponse.arrayBuffer();
              const base64Video = btoa(
                new Uint8Array(videoBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
              );
              videoData = `data:video/mp4;base64,${base64Video}`;
              console.log("Video generation completed!");
              break;
            }

            const errText = await resultResponse.text();
            console.error("Video polling error:", resultResponse.status, errText);
            break;
          }
        }
      } else {
        const errText = await startResponse.text();
        console.error("Stability AI video error:", startResponse.status, errText);
      }
    } catch (videoError) {
      console.error("Video generation error:", videoError);
      // Continue without video - still return image and script
    }

    // ======== STEP 4: Deduct credits AFTER success ========
    console.log(`Deducting ${creditCost} credits from user ${userId}...`);

    const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: `Ad Generator (${adStyle}, ${duration})`,
    });

    // Log to audit
    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId,
      amount: -creditCost,
      credit_type: "ad_generation",
      description: `Ad: ${adStyle} style, ${duration}, ${language} - ${productDescription.substring(0, 50)}`,
    });

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
    console.log(`Ad generated for user ${userId}. Credits: ${creditCost}, Balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        adScript,
        enhancedImage: enhancedImageBase64,
        video: videoData,
        creditsUsed: creditCost,
        newBalance,
        duration,
        style: adStyle,
        language,
        voiceGender,
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
