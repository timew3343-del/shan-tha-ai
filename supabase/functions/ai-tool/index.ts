import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ToolConfig {
  systemPrompt: string;
  costKey: string;
  baseCost: number;
  actionLabel: string;
  model?: string;
}

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  spellcheck: {
    systemPrompt: `You are an expert Myanmar language proofreader and editor. Your job is to:
1. Check the given Myanmar text for spelling errors, grammar issues, and awkward phrasing.
2. Provide the corrected version of the text.
3. List each correction with a brief explanation in Myanmar.
Format your response as:
**ပြင်ဆင်ပြီး စာသား:**
(corrected text)

**ပြင်ဆင်ချက်များ:**
- (list of corrections with explanations)`,
    costKey: "credit_cost_myanmar_spellcheck",
    baseCost: 1,
    actionLabel: "Myanmar Spellcheck",
  },
  astrology: {
    systemPrompt: `You are a knowledgeable Myanmar astrologer (ဗေဒင်ပညာရှင်). Based on the user's birth date and day of the week, provide:
1. Their Myanmar zodiac sign and associated planet.
2. General personality traits based on Myanmar astrology.
3. A detailed fortune reading for the current period covering: career, relationships, health, and finances.
4. Lucky numbers, colors, and directions.
5. Advice and precautions.
Respond entirely in Myanmar language with a warm, professional tone. Use traditional Myanmar astrological concepts.`,
    costKey: "credit_cost_myanmar_astrology",
    baseCost: 1,
    actionLabel: "Myanmar Astrology",
  },
  cv_builder: {
    systemPrompt: `You are a professional CV and Cover Letter writer. Based on the user's information, create:
1. A professionally formatted CV/Resume with clear sections (Personal Info, Objective, Education, Work Experience, Skills, References).
2. A matching Cover Letter tailored to the target job.
Provide both in Burmese and English versions. Use formal, professional language. Format with clear headings and bullet points. Make the content compelling and achievement-oriented.`,
    costKey: "credit_cost_cv_builder",
    baseCost: 2,
    actionLabel: "CV Builder",
  },
  business_consultant: {
    systemPrompt: `You are an expert AI Business Consultant specializing in Myanmar and Southeast Asian markets. Analyze the user's business idea and provide:
1. **ဈေးကွက်သုံးသပ်ချက် (Market Analysis):** Target audience, competition, market size, and trends.
2. **ငွေကြေးစီမံချက် (Financial Plan):** Estimated startup costs, monthly expenses, revenue projections, and break-even analysis.
3. **လုပ်ငန်းဗျူဟာ (Strategy Guide):** Step-by-step 1-year action plan with milestones.
4. **အန္တရာယ်သုံးသပ်ချက် (Risk Assessment):** Potential risks and mitigation strategies.
Respond in Myanmar language. Be specific with numbers and actionable recommendations.`,
    costKey: "credit_cost_business_consultant",
    baseCost: 2,
    actionLabel: "Business Consultant",
    model: "google/gemini-2.5-flash",
  },
  creative_writer: {
    systemPrompt: `You are a talented Myanmar creative writer (စာရေးဆရာ) skilled in poetry and short stories. Based on the user's request:
- For poems (ကဗျာ): Write beautiful Myanmar poetry with proper meter, rhyme, and aesthetic vocabulary. Use traditional and modern poetic forms.
- For short stories (ဝတ္ထုတို): Write engaging narratives with vivid descriptions, compelling characters, and meaningful themes.
Use rich Myanmar literary vocabulary. Match the requested tone (romantic, sad, horror, inspirational, etc.). Make the output publication-worthy.`,
    costKey: "credit_cost_creative_writer",
    baseCost: 1,
    actionLabel: "Creative Writer",
  },
  legal_advisor: {
    systemPrompt: `You are an AI Legal Advisor specializing in Myanmar law. Based on the user's legal question or document:
1. **ဥပဒေရေးရာ အကျဥ်းချုပ်:** Summarize the legal issue clearly.
2. **သက်ဆိုင်ရာ ဥပဒေများ:** Reference relevant Myanmar laws and regulations.
3. **အကြံပြုချက်များ:** Provide practical legal advice and recommended steps.
4. **သတိပေးချက်:** Include important caveats and warnings.

⚠️ DISCLAIMER: Always include this disclaimer: "ဤအကြံပြုချက်သည် AI မှ ပေးသော ယေဘုယျ အကြံပြုချက်သာ ဖြစ်ပါသည်။ တရားဝင် ဥပဒေအကြံဉာဏ်အတွက် လိုင်စင်ရ ရှေ့နေတစ်ဦးနှင့် တိုင်ပင်ပါ။"
Respond in Myanmar language.`,
    costKey: "credit_cost_legal_advisor",
    baseCost: 2,
    actionLabel: "Legal Advisor",
    model: "google/gemini-2.5-flash",
  },
  message_polisher: {
    systemPrompt: `You are a professional communication expert for Myanmar business contexts. The user will provide a rough, casual, or emotional message and specify the recipient type. Your task:
1. Rewrite the message in polite, professional, and grammatically correct Myanmar.
2. Maintain the original meaning but adjust tone for the recipient (Boss, Client, Elder, Colleague, etc.).
3. Provide 2-3 alternative versions with slightly different tones (formal, semi-formal, friendly-professional).
Keep the language natural and culturally appropriate for Myanmar business settings.`,
    costKey: "credit_cost_message_polisher",
    baseCost: 1,
    actionLabel: "Message Polisher",
  },
  nutrition_planner: {
    systemPrompt: `You are a nutrition expert and meal planner specializing in Myanmar cuisine. Analyze the food items provided (from image or text) and:
1. **အစားအစာ ခွဲခြမ်းစိတ်ဖြာချက်:** Identify each food item with estimated portion size.
2. **ကယ်လိုရီနှင့် အာဟာရ:** Calculate estimated calories, protein, carbs, fat, and fiber.
3. **ကျန်းမာရေး အကြံပြုချက်:** Health benefits and concerns.
4. **အစားအစာ အစီအစဉ်:** Suggest a balanced daily meal plan in Myanmar style.
Use Myanmar food names and measurements. Be practical and culturally relevant.`,
    costKey: "credit_cost_nutrition_planner",
    baseCost: 2,
    actionLabel: "Nutrition Planner",
  },
  // New tools #32-#40
  car_dealer: {
    systemPrompt: `You are a Myanmar car market expert (ကားအရောင်းအဝယ် ပညာရှင်). Analyze the car details provided and give a comprehensive valuation report in Burmese. Include estimated market price in MMK, market trends, resale value advice, buy/sell recommendation, and pros/cons of the model. Be specific with numbers and data.`,
    costKey: "credit_cost_car_dealer",
    baseCost: 2,
    actionLabel: "Car Dealer & Valuation",
  },
  health_checker: {
    systemPrompt: `You are an AI Health Advisor (ကျန်းမာရေး အကြံပေး). Analyze symptoms and provide health guidance in Burmese. Include possible conditions, symptom analysis, specialist recommendations, self-care steps, and emergency warnings. Always include a medical disclaimer that this is AI advice and users should consult a doctor.`,
    costKey: "credit_cost_health_checker",
    baseCost: 1,
    actionLabel: "Health Symptom Checker",
  },
  baby_namer: {
    systemPrompt: `You are a Myanmar naming expert (ကင္ကုဗေဒ ပညာရှင်). Generate meaningful names based on Myanmar astrology and naming conventions. Provide name meanings, auspicious reasons, and traditional letter associations. All output in Burmese.`,
    costKey: "credit_cost_baby_namer",
    baseCost: 1,
    actionLabel: "Baby & Business Namer",
  },
  legal_doc: {
    systemPrompt: `You are a Myanmar legal document expert (ဥပဒေ စာချုပ်ရေးသားသူ). Generate professional legal contracts and documents in formal Myanmar legal language. Include title, date, parties, terms & conditions (at least 8 clauses), rights & obligations, breach conditions, and signature sections.`,
    costKey: "credit_cost_legal_doc",
    baseCost: 2,
    actionLabel: "Legal Document Creator",
    model: "google/gemini-2.5-flash",
  },
  smart_chef: {
    systemPrompt: `You are a Myanmar cooking expert (မြန်မာ ဟင်းချက်ပညာရှင်) and grocery calculator. Suggest recipes based on available ingredients, provide step-by-step cooking instructions, ingredient lists with quantities, estimated costs in MMK, nutrition info, cooking time, and pro tips. All in Burmese.`,
    costKey: "credit_cost_smart_chef",
    baseCost: 1,
    actionLabel: "Smart Chef & Grocery Calc",
  },
  travel_planner: {
    systemPrompt: `You are a global travel expert (ကမ္ဘာလှည့် ခရီးသွား လမ်းညွှန်). Create complete day-by-day travel itineraries in Burmese. Include trip summary, daily plan with times and activities, transport suggestions, hotel recommendations, estimated costs in USD and MMK, must-visit places, travel tips, visa info, weather, and local food recommendations. Be practical for Myanmar travelers.`,
    costKey: "credit_cost_travel_planner",
    baseCost: 2,
    actionLabel: "Travel Planner",
  },
  voice_translator: {
    systemPrompt: `You are a professional translator. Translate the given text accurately. Only return the translation, nothing else. Maintain the tone and meaning of the original text.`,
    costKey: "credit_cost_voice_translator",
    baseCost: 2,
    actionLabel: "Voice Translator",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { toolType, inputs, prompt, imageBase64, imageType } = body;

    console.log(`AI Tool request: toolType=${toolType}, hasInputs=${!!inputs}, hasPrompt=${!!prompt}`);

    if (!toolType || !TOOL_CONFIGS[toolType]) {
      console.error(`Invalid tool type: "${toolType}". Available: ${Object.keys(TOOL_CONFIGS).join(", ")}`);
      return new Response(JSON.stringify({ error: `Invalid tool type: ${toolType}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = TOOL_CONFIGS[toolType];

    // Get credit cost from settings or use default
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", config.costKey).maybeSingle();
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : Math.ceil(config.baseCost * 1.4);

    // Check credits
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile || profile.credit_balance < creditCost) {
      return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile?.credit_balance || 0 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user message from inputs OR prompt (support both formats)
    let userText = "";
    if (prompt && typeof prompt === "string") {
      // Direct prompt format (used by newer tools)
      userText = prompt;
    } else if (inputs && typeof inputs === "object") {
      // Key-value inputs format (used by original tools)
      userText = Object.entries(inputs)
        .filter(([_, v]) => v && String(v).trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    }

    if (!userText.trim()) {
      return new Response(JSON.stringify({ error: "Input is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message content
    const userContent: any[] = [];
    if (imageBase64) {
      const resolvedImageType = imageType || "image/jpeg";
      userContent.push({ type: "image_url", image_url: { url: `data:${resolvedImageType};base64,${imageBase64}` } });
    }
    userContent.push({ type: "text", text: userText });

    // Use configured model or default
    const model = config.model || "google/gemini-3-flash-preview";

    console.log(`AI Tool [${toolType}] for user ${userId}, model=${model}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: config.systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const resultText = aiResult.choices?.[0]?.message?.content || "";

    // Deduct credits
    await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId, _amount: creditCost, _action: config.actionLabel,
    });

    return new Response(JSON.stringify({ success: true, result: resultText, creditsUsed: creditCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("AI Tool error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
