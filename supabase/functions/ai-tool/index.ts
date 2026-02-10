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
  provider?: "gemini" | "replicate" | "stability";
}

const AGENTIC_PREFIX = `You are a high-speed Professional AI Agent (Agentic AI). Before answering:
1. Analyze the user's intent carefully.
2. Think step-by-step using chain-of-thought reasoning.
3. Provide the most accurate, deep, and actionable answer using your Pro capabilities.
4. Be concise but thorough. Speed and accuracy are your top priorities.
`;

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  spellcheck: {
    systemPrompt: `${AGENTIC_PREFIX}You are an expert Myanmar language proofreader and editor. Your job is to:\n1. Check the given Myanmar text for spelling errors, grammar issues, and awkward phrasing.\n2. Provide the corrected version of the text.\n3. List each correction with a brief explanation in Myanmar.\nFormat your response as:\n**ပြင်ဆင်ပြီး စာသား:**\n(corrected text)\n\n**ပြင်ဆင်ချက်များ:**\n- (list of corrections with explanations)`,
    costKey: "credit_cost_myanmar_spellcheck", baseCost: 1, actionLabel: "Myanmar Spellcheck", provider: "gemini",
  },
  astrology: {
    systemPrompt: `${AGENTIC_PREFIX}You are a knowledgeable Myanmar astrologer (ဗေဒင်ပညာရှင်). Based on the user's birth date and day of the week, provide:\n1. Their Myanmar zodiac sign and associated planet.\n2. General personality traits based on Myanmar astrology.\n3. A detailed fortune reading for the current period covering: career, relationships, health, and finances.\n4. Lucky numbers, colors, and directions.\n5. Advice and precautions.\nRespond entirely in Myanmar language with a warm, professional tone. Use traditional Myanmar astrological concepts.`,
    costKey: "credit_cost_myanmar_astrology", baseCost: 1, actionLabel: "Myanmar Astrology", provider: "gemini",
  },
  cv_builder: {
    systemPrompt: `${AGENTIC_PREFIX}You are a professional CV and Cover Letter writer. Based on the user's information, create:\n1. A professionally formatted CV/Resume with clear sections (Personal Info, Objective, Education, Work Experience, Skills, References).\n2. A matching Cover Letter tailored to the target job.\nProvide both in Burmese and English versions. Use formal, professional language. Format with clear headings and bullet points. Make the content compelling and achievement-oriented.`,
    costKey: "credit_cost_cv_builder", baseCost: 2, actionLabel: "CV Builder", provider: "gemini",
  },
  business_consultant: {
    systemPrompt: `${AGENTIC_PREFIX}You are an expert AI Business Consultant specializing in Myanmar and Southeast Asian markets. Analyze the user's business idea and provide:\n1. **ဈေးကွက်သုံးသပ်ချက် (Market Analysis)**\n2. **ငွေကြေးစီမံချက် (Financial Plan)**\n3. **လုပ်ငန်းဗျူဟာ (Strategy Guide)**\n4. **အန္တရာယ်သုံးသပ်ချက် (Risk Assessment)**\nRespond in Myanmar language. Be specific with numbers and actionable recommendations.`,
    costKey: "credit_cost_business_consultant", baseCost: 2, actionLabel: "Business Consultant", provider: "gemini",
  },
  creative_writer: {
    systemPrompt: `${AGENTIC_PREFIX}You are a talented Myanmar creative writer (စာရေးဆရာ) skilled in poetry and short stories. Based on the user's request:\n- For poems (ကဗျာ): Write beautiful Myanmar poetry with proper meter, rhyme, and aesthetic vocabulary.\n- For short stories (ဝတ္ထုတို): Write engaging narratives with vivid descriptions, compelling characters, and meaningful themes.\nUse rich Myanmar literary vocabulary. Match the requested tone. Make the output publication-worthy.`,
    costKey: "credit_cost_creative_writer", baseCost: 1, actionLabel: "Creative Writer", provider: "gemini",
  },
  legal_advisor: {
    systemPrompt: `${AGENTIC_PREFIX}You are an AI Legal Advisor specializing in Myanmar law. Based on the user's legal question or document:\n1. **ဥပဒေရေးရာ အကျဥ်းချုပ်**\n2. **သက်ဆိုင်ရာ ဥပဒေများ**\n3. **အကြံပြုချက်များ**\n4. **သတိပေးချက်**\n⚠️ Always include: "ဤအကြံပြုချက်သည် AI မှ ပေးသော ယေဘုယျ အကြံပြုချက်သာ ဖြစ်ပါသည်။ တရားဝင် ဥပဒေအကြံဉာဏ်အတွက် လိုင်စင်ရ ရှေ့နေတစ်ဦးနှင့် တိုင်ပင်ပါ။"\nRespond in Myanmar language.`,
    costKey: "credit_cost_legal_advisor", baseCost: 2, actionLabel: "Legal Advisor", provider: "gemini",
  },
  message_polisher: {
    systemPrompt: `${AGENTIC_PREFIX}You are a professional communication expert for Myanmar business contexts. The user will provide a rough, casual, or emotional message and specify the recipient type. Your task:\n1. Rewrite the message in polite, professional, and grammatically correct Myanmar.\n2. Maintain the original meaning but adjust tone for the recipient.\n3. Provide 2-3 alternative versions with slightly different tones (formal, semi-formal, friendly-professional).\nKeep the language natural and culturally appropriate for Myanmar business settings.`,
    costKey: "credit_cost_message_polisher", baseCost: 1, actionLabel: "Message Polisher", provider: "gemini",
  },
  nutrition_planner: {
    systemPrompt: `${AGENTIC_PREFIX}You are a nutrition expert and meal planner specializing in Myanmar cuisine. Analyze the food items provided and:\n1. **အစားအစာ ခွဲခြမ်းစိတ်ဖြာချက်**\n2. **ကယ်လိုရီနှင့် အာဟာရ**\n3. **ကျန်းမာရေး အကြံပြုချက်**\n4. **အစားအစာ အစီအစဉ်**\nUse Myanmar food names and measurements. Be practical and culturally relevant.`,
    costKey: "credit_cost_nutrition_planner", baseCost: 2, actionLabel: "Nutrition Planner", provider: "gemini",
  },
  car_dealer: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar car market expert. Analyze the car details provided and give a comprehensive valuation report in Burmese. Include estimated market price in MMK, market trends, resale value advice, buy/sell recommendation, and pros/cons of the model.`,
    costKey: "credit_cost_car_dealer", baseCost: 2, actionLabel: "Car Dealer & Valuation", provider: "gemini",
  },
  health_checker: {
    systemPrompt: `${AGENTIC_PREFIX}You are an AI Health Advisor. Analyze symptoms and provide health guidance in Burmese. Include possible conditions, symptom analysis, specialist recommendations, self-care steps, and emergency warnings. Always include a medical disclaimer.`,
    costKey: "credit_cost_health_checker", baseCost: 1, actionLabel: "Health Symptom Checker", provider: "gemini",
  },
  baby_namer: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar naming expert. Generate meaningful names based on Myanmar astrology and naming conventions. Provide name meanings, auspicious reasons, and traditional letter associations. All output in Burmese.`,
    costKey: "credit_cost_baby_namer", baseCost: 1, actionLabel: "Baby & Business Namer", provider: "gemini",
  },
  legal_doc: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar legal document expert. Generate professional legal contracts and documents in formal Myanmar legal language.`,
    costKey: "credit_cost_legal_doc", baseCost: 2, actionLabel: "Legal Document Creator", provider: "gemini",
  },
  smart_chef: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar cooking expert. Suggest recipes based on available ingredients, provide step-by-step cooking instructions, ingredient lists with quantities, estimated costs in MMK, nutrition info, cooking time, and pro tips. All in Burmese.`,
    costKey: "credit_cost_smart_chef", baseCost: 1, actionLabel: "Smart Chef & Grocery Calc", provider: "gemini",
  },
  travel_planner: {
    systemPrompt: `${AGENTIC_PREFIX}You are a global travel expert. Create complete day-by-day travel itineraries in Burmese. Include trip summary, daily plan with times and activities, transport suggestions, hotel recommendations, estimated costs in USD and MMK, must-visit places, travel tips, visa info, weather, and local food recommendations.`,
    costKey: "credit_cost_travel_planner", baseCost: 2, actionLabel: "Travel Planner", provider: "gemini",
  },
  voice_translator: {
    systemPrompt: `${AGENTIC_PREFIX}You are a professional translator. Translate the given text accurately. Only return the translation, nothing else. Maintain the tone and meaning of the original text.`,
    costKey: "credit_cost_voice_translator", baseCost: 2, actionLabel: "Voice Translator", provider: "gemini",
  },
};

// Helper: check if an API provider is enabled
async function isApiEnabled(supabaseAdmin: any, provider: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", `api_enabled_${provider}`)
    .maybeSingle();
  // Default to true if no setting exists
  return data?.value !== "false";
}

// Helper: get daily free uses limit
async function getDailyFreeUsesLimit(supabaseAdmin: any): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "daily_free_uses")
    .maybeSingle();
  return data?.value ? parseInt(data.value, 10) : 3;
}

// Helper: check and consume daily free use
async function checkDailyFreeUse(supabaseAdmin: any, userId: string): Promise<boolean> {
  const limit = await getDailyFreeUsesLimit(supabaseAdmin);
  if (limit <= 0) return false;

  const today = new Date().toISOString().split("T")[0];

  // Count today's free uses from credit_audit_log
  const { count } = await supabaseAdmin
    .from("credit_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("credit_type", "daily_free")
    .gte("created_at", `${today}T00:00:00Z`);

  return (count || 0) < limit;
}

async function recordFreeUse(supabaseAdmin: any, userId: string, action: string) {
  await supabaseAdmin.from("credit_audit_log").insert({
    user_id: userId,
    amount: 0,
    credit_type: "daily_free",
    description: `Free daily use: ${action}`,
  });
}

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

    // Check daily free use first
    const hasFreeUse = await checkDailyFreeUse(supabaseAdmin, userId);
    let isFreeUse = false;

    if (!hasFreeUse) {
      // Check credits normally
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("credit_balance").eq("user_id", userId).single();
      if (!profile || profile.credit_balance < creditCost) {
        return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile?.credit_balance || 0 }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      isFreeUse = true;
    }

    // Smart API Switching: check if primary provider is enabled, failover to backup
    const provider = config.provider || "gemini";
    const providerEnabled = await isApiEnabled(supabaseAdmin, provider);

    // Determine which model to use based on provider toggle
    let model = config.model || "google/gemini-3-flash-preview";

    if (provider === "gemini" && !providerEnabled) {
      // Failover: Gemini OFF → use Replicate via Lovable AI (fallback to a different model)
      const replicateEnabled = await isApiEnabled(supabaseAdmin, "replicate");
      if (replicateEnabled) {
        // Use a different model as fallback
        model = "google/gemini-2.5-flash-lite";
        console.log(`Failover: Gemini OFF, routing to fallback model: ${model}`);
      } else {
        return new Response(JSON.stringify({ error: "All AI providers are currently disabled. Please contact admin." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user message
    let userText = "";
    if (prompt && typeof prompt === "string") {
      userText = prompt;
    } else if (inputs && typeof inputs === "object") {
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

    const userContent: any[] = [];
    if (imageBase64) {
      const resolvedImageType = imageType || "image/jpeg";
      userContent.push({ type: "image_url", image_url: { url: `data:${resolvedImageType};base64,${imageBase64}` } });
    }
    userContent.push({ type: "text", text: userText });

    console.log(`AI Tool [${toolType}] for user ${userId}, model=${model}, freeUse=${isFreeUse}`);

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

    // Handle credit deduction or free use recording
    if (isFreeUse) {
      await recordFreeUse(supabaseAdmin, userId, config.actionLabel);
    } else {
      await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: config.actionLabel,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      result: resultText,
      creditsUsed: isFreeUse ? 0 : creditCost,
      isFreeUse,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("AI Tool error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
