import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Section {
  title: string;
  description: string;
  imagePrompt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // ===== ADMIN CHECK =====
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;
    console.log(`Doc/Slides: user=${userId}, isAdmin=${userIsAdmin}`);

    const { content, imageCount, language, step } = await req.json();

    // Get API keys from app_settings
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["gemini_api_key", "stability_api_key", "credit_cost_doc_slides", "profit_margin"]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: any) => { settingsMap[s.key] = s.value || ""; });

    const geminiKey = settingsMap.gemini_api_key || Deno.env.get("GEMINI_API_KEY");
    const stabilityKey = settingsMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");

    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== CREDIT COST CALCULATION =====
    let creditCost: number;
    if (settingsMap.credit_cost_doc_slides) {
      creditCost = parseInt(settingsMap.credit_cost_doc_slides, 10);
    } else {
      const profitMargin = settingsMap.profit_margin ? parseInt(settingsMap.profit_margin, 10) : 40;
      const BASE_COST = 5;
      creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    }

    // ===== CREDIT CHECK (skip for admin) - only on analyze step =====
    if (step === "analyze" && !userIsAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("credit_balance").eq("user_id", userId).single();

      if (!profile || profile.credit_balance < creditCost) {
        return new Response(JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost, balance: profile?.credit_balance ?? 0 }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Step 1: Text analysis with Gemini
    if (step === "analyze") {
      console.log("Step 1: Analyzing text with Gemini...");
      
      const languageInstruction = language === "myanmar" 
        ? "Write all titles and descriptions in Myanmar language."
        : language === "english" 
        ? "Write all titles and descriptions in English." 
        : "Write titles in English and descriptions in both Myanmar and English.";

      const prompt = `Analyze the following content and break it into ${imageCount} sections for a professional presentation/document. 
      
For each section, provide:
1. A clear, concise title
2. A descriptive paragraph (2-3 sentences) explaining the section
3. A highly descriptive image generation prompt (in English) that would create a professional 16:9 image for this section. The prompt should be specific about colors, composition, style, and mood.

${languageInstruction}

Content to analyze:
${content}

Respond in this exact JSON format:
{
  "sections": [
    {
      "title": "Section Title",
      "description": "Section description text...",
      "imagePrompt": "A professional 16:9 image showing..."
    }
  ]
}`;

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.error("Gemini API error:", errText);
        return new Response(JSON.stringify({ error: "Gemini API error", details: errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const geminiData = await geminiResponse.json();
      const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textContent) {
        return new Response(JSON.stringify({ error: "No content from Gemini" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let sections: Section[];
      try {
        const parsed = JSON.parse(textContent);
        sections = parsed.sections;
      } catch {
        console.error("Failed to parse Gemini response:", textContent);
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct credits after success (skip for admin)
      if (!userIsAdmin) {
        await supabaseAdmin.rpc("deduct_user_credits", {
          _user_id: userId,
          _amount: creditCost,
          _action: "Doc/Slide generation",
        });
      } else {
        console.log("Admin free access - skipping credit deduction for Doc/Slides");
      }

      // Log usage for analytics
      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId,
        amount: userIsAdmin ? 0 : -creditCost,
        credit_type: "doc_slide_analyze",
        description: `Doc/Slide text analysis - ${sections.length} sections`,
      });

      // Save to user_outputs
      try {
        await supabaseAdmin.from("user_outputs").insert({
          user_id: userId,
          tool_id: "doc-slides",
          tool_name: "Doc & Slides",
          output_type: "document",
          content: sections.map((s: Section) => `${s.title}: ${s.description}`).join("\n").substring(0, 2000),
        });
        console.log("Doc/Slides output saved to user_outputs");
      } catch (e) {
        console.warn("Failed to save Doc/Slides output:", e);
      }

      return new Response(JSON.stringify({ success: true, sections }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Generate image with Stability AI
    if (step === "generate_image") {
      const { imagePrompt, index } = await req.json().catch(() => ({ imagePrompt: content, index: 0 }));
      const actualPrompt = imagePrompt || content;

      if (!stabilityKey) {
        return new Response(JSON.stringify({ error: "Stability AI API key not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Step 2: Generating image ${index + 1}...`);

      const formData = new FormData();
      formData.append("prompt", actualPrompt);
      formData.append("output_format", "png");
      formData.append("aspect_ratio", "16:9");

      const stabilityResponse = await fetch(
        "https://api.stability.ai/v2beta/stable-image/generate/sd3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stabilityKey}`,
            Accept: "application/json",
          },
          body: formData,
        }
      );

      if (!stabilityResponse.ok) {
        const errText = await stabilityResponse.text();
        console.error("Stability API error:", errText);
        return new Response(JSON.stringify({ error: "Stability API error", details: errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stabilityData = await stabilityResponse.json();
      const imageBase64 = stabilityData.image;

      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "No image generated" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, imageBase64 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid step parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
