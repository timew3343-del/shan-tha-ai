import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContentCalendarRequest {
  mode: "calendar" | "photoshoot";
  images: string[];
  businessDescription: string;
  numDays?: number;
  themePrompt?: string;
  themeName?: string;
  selectedImageIndex?: number;
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

    const userId = claims.claims.sub as string;
    const body: ContentCalendarRequest = await req.json();
    const { mode, images, businessDescription, numDays = 7, themePrompt, themeName, selectedImageIndex } = body;

    if (!images || images.length === 0 || !businessDescription) {
      return new Response(
        JSON.stringify({ error: "Images and business description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Social media agent request: user=${userId}, mode=${mode}, images=${images.length}, numDays=${numDays}`);

    // Fetch global profit margin and calculate credit cost
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();
    
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    
    let creditCost: number;
    if (mode === "photoshoot") {
      const BASE_COST = 6; // Base API cost for photoshoot
      creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    } else {
      // Calendar: per-day pricing
      const BASE_7DAY_COST = 18; // Base API cost for 7-day calendar
      const base7DayCostWithMargin = Math.ceil(BASE_7DAY_COST * (1 + profitMargin / 100));
      const perDayCost = Math.ceil(base7DayCostWithMargin / 7);
      creditCost = perDayCost * Math.min(Math.max(numDays, 1), 30);
    }

    // Check balance
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("credit_balance").eq("user_id", userId).single();

    if (!profile || profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost, balance: profile?.credit_balance || 0 }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API keys
    const { data: apiKeys } = await supabaseAdmin
      .from("app_settings").select("key, value").in("key", ["stability_api_key"]);

    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k) => { keyMap[k.key] = k.value || ""; });

    const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!STABILITY_API_KEY) {
      return new Response(JSON.stringify({ error: "Stability AI key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===================== PHOTOSHOOT MODE =====================
    if (mode === "photoshoot") {
      console.log("Photoshoot mode: transforming image with theme:", themeName);

      const imgIndex = selectedImageIndex ?? 0;
      let imageData = images[imgIndex];
      if (imageData.includes(",")) imageData = imageData.split(",")[1];

      const imageBytes = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
      const imageBlob = new Blob([imageBytes], { type: "image/png" });

      const formData = new FormData();
      formData.append("image", imageBlob, "product.png");
      formData.append("prompt", `${themePrompt}, professional product photography, high quality commercial shot, ${businessDescription}`);
      formData.append("search_prompt", "background");
      formData.append("output_format", "png");

      const stabilityResponse = await fetch(
        "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace",
        { method: "POST", headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" }, body: formData }
      );

      if (!stabilityResponse.ok) {
        const errText = await stabilityResponse.text();
        console.error("Stability AI error:", stabilityResponse.status, errText);
        return new Response(JSON.stringify({ error: "Image processing failed: " + errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const resultBuffer = await stabilityResponse.arrayBuffer();
      const base64Result = btoa(String.fromCharCode(...new Uint8Array(resultBuffer)));
      const fileName = `photoshoot_${userId}_${Date.now()}.png`;
      const uploadBytes = Uint8Array.from(atob(base64Result), (c) => c.charCodeAt(0));

      await supabaseAdmin.storage.from("videos").upload(fileName, uploadBytes, { contentType: "image/png", upsert: true });
      const { data: urlData } = supabaseAdmin.storage.from("videos").getPublicUrl(fileName);

      await supabaseAdmin.rpc("deduct_user_credits", { _user_id: userId, _amount: creditCost, _action: "Professional Photoshoot" });
      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId, amount: -creditCost, credit_type: "photoshoot",
        description: `Photoshoot: ${themeName} - ${businessDescription.substring(0, 50)}`,
      });

      return new Response(JSON.stringify({
        success: true, resultImageUrl: urlData.publicUrl, creditsUsed: creditCost,
        newBalance: profile.credit_balance - creditCost,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===================== CALENDAR MODE =====================
    const actualDays = Math.min(Math.max(numDays, 1), 30);
    console.log(`Calendar mode: generating ${actualDays}-day content plan...`);

    const calendarResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a social media marketing expert. Create a ${actualDays}-day content calendar.
Return valid JSON with this structure:
{
  "days": [
    {
      "day": 1, "dayName": "Day 1",
      "caption_my": "Myanmar language caption with emojis",
      "caption_en": "English caption with emojis",
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
      "bestTime": "9:00 AM",
      "visualTheme": "Description of the visual style",
      "contentType": "Product Showcase / Behind the Scenes / Tips & Tricks / Story / Promo / Engagement"
    }
  ]
}
Make each day unique. Include Myanmar and English captions. Create exactly ${actualDays} days.`,
          },
          {
            role: "user",
            content: `Business: ${businessDescription}. I have ${images.length} product images. Create a ${actualDays}-day social media content calendar.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: actualDays > 15 ? 6000 : 3000,
      }),
    });

    let calendarData: any = { days: [] };
    if (calendarResponse.ok) {
      const calData = await calendarResponse.json();
      const content = calData.choices?.[0]?.message?.content;
      if (content) {
        try { calendarData = JSON.parse(content); } catch { console.error("Failed to parse calendar JSON"); }
      }
      console.log("Content calendar generated with", calendarData.days?.length, "days");
    } else {
      console.error("Gemini calendar error:", await calendarResponse.text());
    }

    // Generate enhanced images (up to 7 images max to avoid API rate limits)
    const enhancedImages: string[] = [];
    const days = calendarData.days || [];
    const imagesToGenerate = Math.min(days.length, 7);

    for (let i = 0; i < imagesToGenerate; i++) {
      const day = days[i];
      const imageIndex = i % images.length;
      let imageData = images[imageIndex];
      if (imageData.includes(",")) imageData = imageData.split(",")[1];

      try {
        const imageBytes = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
        const imageBlob = new Blob([imageBytes], { type: "image/png" });

        const formData = new FormData();
        formData.append("image", imageBlob, "product.png");
        formData.append("prompt", `${day.visualTheme}, professional social media product photography, high quality, ${businessDescription}`);
        formData.append("search_prompt", "background");
        formData.append("output_format", "png");

        const stabResp = await fetch("https://api.stability.ai/v2beta/stable-image/edit/search-and-replace", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
          body: formData,
        });

        if (stabResp.ok) {
          const resultBuffer = await stabResp.arrayBuffer();
          const base64Result = btoa(String.fromCharCode(...new Uint8Array(resultBuffer)));
          const fileName = `social_${userId}_day${i + 1}_${Date.now()}.png`;
          const uploadBytes = Uint8Array.from(atob(base64Result), (c) => c.charCodeAt(0));
          await supabaseAdmin.storage.from("videos").upload(fileName, uploadBytes, { contentType: "image/png", upsert: true });
          const { data: urlData } = supabaseAdmin.storage.from("videos").getPublicUrl(fileName);
          enhancedImages.push(urlData.publicUrl);
          console.log(`Day ${i + 1} image enhanced`);
        } else {
          console.error(`Day ${i + 1} image failed:`, await stabResp.text());
          enhancedImages.push("");
        }
      } catch (err) {
        console.error(`Day ${i + 1} image error:`, err);
        enhancedImages.push("");
      }

      if (i < imagesToGenerate - 1) await new Promise(r => setTimeout(r, 1000));
    }

    // Fill remaining days without images
    for (let i = imagesToGenerate; i < days.length; i++) {
      enhancedImages.push(enhancedImages[i % imagesToGenerate] || "");
    }

    await supabaseAdmin.rpc("deduct_user_credits", { _user_id: userId, _amount: creditCost, _action: "Social Media Agent" });
    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId, amount: -creditCost, credit_type: "social_media_agent",
      description: `${actualDays}-Day Calendar: ${businessDescription.substring(0, 50)}`,
    });

    console.log(`Social media calendar generated for user ${userId}. Days: ${actualDays}, Credits: ${creditCost}`);

    return new Response(JSON.stringify({
      success: true, calendar: calendarData, enhancedImages,
      creditsUsed: creditCost, newBalance: profile.credit_balance - creditCost,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Social media agent error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
