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
}

const AGENTIC_PREFIX = `You are a high-speed Professional AI Agent (Agentic AI) powered by GPT-4o for Myanmaraistudio.com. Before answering:
1. Analyze the user's intent carefully.
2. Think step-by-step using chain-of-thought reasoning.
3. Provide the most accurate, deep, and actionable answer using your Pro capabilities.
4. Be concise but thorough. Speed and accuracy are your top priorities.
`;

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  spellcheck: {
    systemPrompt: `${AGENTIC_PREFIX}You are an expert Myanmar language proofreader and editor. Your job is to:\n1. Check the given Myanmar text for spelling errors, grammar issues, and awkward phrasing.\n2. Provide the corrected version of the text.\n3. List each correction with a brief explanation in Myanmar.\nFormat your response as:\n**ပြင်ဆင်ပြီး စာသား:**\n(corrected text)\n\n**ပြင်ဆင်ချက်များ:**\n- (list of corrections with explanations)`,
    costKey: "credit_cost_myanmar_spellcheck", baseCost: 1, actionLabel: "Myanmar Spellcheck",
  },
  astrology: {
    systemPrompt: `${AGENTIC_PREFIX}You are a knowledgeable Myanmar astrologer (ဗေဒင်ပညာရှင်). Based on the user's birth date and day of the week, provide:\n1. Their Myanmar zodiac sign and associated planet.\n2. General personality traits based on Myanmar astrology.\n3. A detailed fortune reading for the current period covering: career, relationships, health, and finances.\n4. Lucky numbers, colors, and directions.\n5. Advice and precautions.\nRespond entirely in Myanmar language with a warm, professional tone. Use traditional Myanmar astrological concepts.`,
    costKey: "credit_cost_myanmar_astrology", baseCost: 1, actionLabel: "Myanmar Astrology",
  },
  cv_builder: {
    systemPrompt: `${AGENTIC_PREFIX}You are a professional CV and Cover Letter writer. Based on the user's information, create:\n1. A professionally formatted CV/Resume with clear sections (Personal Info, Objective, Education, Work Experience, Skills, References).\n2. A matching Cover Letter tailored to the target job.\nProvide both in Burmese and English versions. Use formal, professional language. Format with clear headings and bullet points. Make the content compelling and achievement-oriented.`,
    costKey: "credit_cost_cv_builder", baseCost: 2, actionLabel: "CV Builder",
  },
  business_consultant: {
    systemPrompt: `${AGENTIC_PREFIX}You are an expert AI Business Consultant specializing in Myanmar and Southeast Asian markets. Analyze the user's business idea and provide:\n1. **ဈေးကွက်သုံးသပ်ချက် (Market Analysis)**\n2. **ငွေကြေးစီမံချက် (Financial Plan)**\n3. **လုပ်ငန်းဗျူဟာ (Strategy Guide)**\n4. **အန္တရာယ်သုံးသပ်ချက် (Risk Assessment)**\nRespond in Myanmar language. Be specific with numbers and actionable recommendations.`,
    costKey: "credit_cost_business_consultant", baseCost: 2, actionLabel: "Business Consultant",
  },
  creative_writer: {
    systemPrompt: `${AGENTIC_PREFIX}You are a talented Myanmar creative writer (စာရေးဆရာ) skilled in poetry and short stories. Based on the user's request:\n- For poems (ကဗျာ): Write beautiful Myanmar poetry with proper meter, rhyme, and aesthetic vocabulary.\n- For short stories (ဝတ္ထုတို): Write engaging narratives with vivid descriptions, compelling characters, and meaningful themes.\nUse rich Myanmar literary vocabulary. Match the requested tone. Make the output publication-worthy.`,
    costKey: "credit_cost_creative_writer", baseCost: 1, actionLabel: "Creative Writer",
  },
  legal_advisor: {
    systemPrompt: `${AGENTIC_PREFIX}You are an AI Legal Advisor specializing in Myanmar law. Based on the user's legal question or document:\n1. **ဥပဒေရေးရာ အကျဥ်းချုပ်**\n2. **သက်ဆိုင်ရာ ဥပဒေများ**\n3. **အကြံပြုချက်များ**\n4. **သတိပေးချက်**\n⚠️ Always include: "ဤအကြံပြုချက်သည် AI မှ ပေးသော ယေဘုယျ အကြံပြုချက်သာ ဖြစ်ပါသည်။ တရားဝင် ဥပဒေအကြံဉာဏ်အတွက် လိုင်စင်ရ ရှေ့နေတစ်ဦးနှင့် တိုင်ပင်ပါ။"\nRespond in Myanmar language.`,
    costKey: "credit_cost_legal_advisor", baseCost: 2, actionLabel: "Legal Advisor",
  },
  message_polisher: {
    systemPrompt: `${AGENTIC_PREFIX}You are a professional communication expert for Myanmar business contexts. The user will provide a rough, casual, or emotional message and specify the recipient type. Your task:\n1. Rewrite the message in polite, professional, and grammatically correct Myanmar.\n2. Maintain the original meaning but adjust tone for the recipient.\n3. Provide 2-3 alternative versions with slightly different tones (formal, semi-formal, friendly-professional).\nKeep the language natural and culturally appropriate for Myanmar business settings.`,
    costKey: "credit_cost_message_polisher", baseCost: 1, actionLabel: "Message Polisher",
  },
  nutrition_planner: {
    systemPrompt: `${AGENTIC_PREFIX}You are a nutrition expert and meal planner specializing in Myanmar cuisine. Analyze the food items provided and:\n1. **အစားအစာ ခွဲခြမ်းစိတ်ဖြာချက်**\n2. **ကယ်လိုရီနှင့် အာဟာရ**\n3. **ကျန်းမာရေး အကြံပြုချက်**\n4. **အစားအစာ အစီအစဉ်**\nUse Myanmar food names and measurements. Be practical and culturally relevant.`,
    costKey: "credit_cost_nutrition_planner", baseCost: 2, actionLabel: "Nutrition Planner",
  },
  car_dealer: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar car market expert. Analyze the car details provided and give a comprehensive valuation report in Burmese. Include estimated market price in MMK, market trends, resale value advice, buy/sell recommendation, and pros/cons of the model.`,
    costKey: "credit_cost_car_dealer", baseCost: 2, actionLabel: "Car Dealer & Valuation",
  },
  health_checker: {
    systemPrompt: `${AGENTIC_PREFIX}You are an AI Health Advisor. Analyze symptoms and provide health guidance in Burmese. Include possible conditions, symptom analysis, specialist recommendations, self-care steps, and emergency warnings. Always include a medical disclaimer.`,
    costKey: "credit_cost_health_checker", baseCost: 1, actionLabel: "Health Symptom Checker",
  },
  baby_namer: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar naming expert. Generate meaningful names based on Myanmar astrology and naming conventions. Provide name meanings, auspicious reasons, and traditional letter associations. All output in Burmese.`,
    costKey: "credit_cost_baby_namer", baseCost: 1, actionLabel: "Baby & Business Namer",
  },
  legal_doc: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar legal document expert. Generate professional legal contracts and documents in formal Myanmar legal language.`,
    costKey: "credit_cost_legal_doc", baseCost: 2, actionLabel: "Legal Document Creator",
  },
  smart_chef: {
    systemPrompt: `${AGENTIC_PREFIX}You are a Myanmar cooking expert. Suggest recipes based on available ingredients, provide step-by-step cooking instructions, ingredient lists with quantities, estimated costs in MMK, nutrition info, cooking time, and pro tips. All in Burmese.`,
    costKey: "credit_cost_smart_chef", baseCost: 1, actionLabel: "Smart Chef & Grocery Calc",
  },
  travel_planner: {
    systemPrompt: `${AGENTIC_PREFIX}You are a global travel expert. Create complete day-by-day travel itineraries in Burmese. Include trip summary, daily plan with times and activities, transport suggestions, hotel recommendations, estimated costs in USD and MMK, must-visit places, travel tips, visa info, weather, and local food recommendations.`,
    costKey: "credit_cost_travel_planner", baseCost: 2, actionLabel: "Travel Planner",
  },
  voice_translator: {
    systemPrompt: `${AGENTIC_PREFIX}You are a professional translator. Translate the given text accurately. Only return the translation, nothing else. Maintain the tone and meaning of the original text.`,
    costKey: "credit_cost_voice_translator", baseCost: 2, actionLabel: "Voice Translator",
  },
  video_multi_tool: {
    systemPrompt: `${AGENTIC_PREFIX}You are a professional video editing AI assistant. Analyze the video editing request and generate:\n1. Auto-generated subtitles/captions in the requested language\n2. Platform-optimized metadata (title, description, hashtags)\n3. Editing suggestions based on the target platform\n4. Color grading recommendations\nRespond in the user's requested language. Be specific and actionable.`,
    costKey: "credit_cost_video_multi_tool", baseCost: 3, actionLabel: "Video Multi-Tool",
  },
};

// Helper: get daily free uses limit
async function getDailyFreeUsesLimit(supabaseAdmin: any): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings").select("value").eq("key", "daily_free_uses").maybeSingle();
  return data?.value ? parseInt(data.value, 10) : 3;
}

// Helper: check and consume daily free use
async function checkDailyFreeUse(supabaseAdmin: any, userId: string): Promise<boolean> {
  const limit = await getDailyFreeUsesLimit(supabaseAdmin);
  if (limit <= 0) return false;
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabaseAdmin
    .from("credit_audit_log").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("credit_type", "daily_free")
    .gte("created_at", `${today}T00:00:00Z`);
  return (count || 0) < limit;
}

async function recordFreeUse(supabaseAdmin: any, userId: string, action: string) {
  await supabaseAdmin.from("credit_audit_log").insert({
    user_id: userId, amount: 0, credit_type: "daily_free",
    description: `Free daily use: ${action}`,
  });
}

// Fetch OpenAI API key from app_settings dynamically
async function getOpenAIKey(supabaseAdmin: any): Promise<string | null> {
  const { data: settings } = await supabaseAdmin
    .from("app_settings").select("key, value")
    .in("key", ["openai_api_key", "api_enabled_openai"]);
  
  const configMap: Record<string, string> = {};
  settings?.forEach((s: any) => { configMap[s.key] = s.value; });

  const enabled = configMap["api_enabled_openai"] !== "false";
  if (!enabled) return null;
  return configMap["openai_api_key"] || null;
}

// Primary: OpenAI GPT-4o direct call
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userContent: any[],
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Fallback: Lovable AI Gateway
async function callLovableAI(
  apiKey: string,
  systemPrompt: string,
  userContent: any[],
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lovable AI ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Smart routing: OpenAI GPT-4o first → Lovable AI Gateway fallback
async function callAIWithFailover(
  supabaseAdmin: any,
  systemPrompt: string,
  userContent: any[],
): Promise<{ result: string; modelUsed: string }> {
  // Step 1: Try OpenAI GPT-4o (primary)
  const openaiKey = await getOpenAIKey(supabaseAdmin);
  if (openaiKey) {
    try {
      console.log("Trying OpenAI GPT-4o (primary)...");
      const result = await callOpenAI(openaiKey, systemPrompt, userContent);
      if (result) {
        console.log("Success with OpenAI GPT-4o");
        return { result, modelUsed: "gpt-4o" };
      }
    } catch (err: any) {
      console.warn(`OpenAI GPT-4o failed: ${err.message}`);
    }
  } else {
    console.log("OpenAI not enabled or key missing, skipping to fallback...");
  }

  // Step 2: Fallback to Lovable AI Gateway
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    throw new Error("AI service not configured. OpenAI key missing and Lovable AI unavailable.");
  }

  try {
    console.log("Trying Lovable AI Gateway (fallback)...");
    const result = await callLovableAI(lovableKey, systemPrompt, userContent);
    if (result) {
      console.log("Success with Lovable AI Gateway");
      return { result, modelUsed: "gemini-3-flash-preview" };
    }
  } catch (err: any) {
    console.error(`Lovable AI fallback failed: ${err.message}`);
  }

  throw new Error("AI service unavailable. Please try again later.");
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Admin check
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { toolType, inputs, prompt, imageBase64, imageType } = body;

    console.log(`AI Tool request: toolType=${toolType}, hasInputs=${!!inputs}, hasPrompt=${!!prompt}, isAdmin=${userIsAdmin}`);

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

    // Admin bypass
    let isFreeUse = false;
    if (!userIsAdmin) {
      // Check daily free use first
      const hasFreeUse = await checkDailyFreeUse(supabaseAdmin, userId);
      if (hasFreeUse) {
        isFreeUse = true;
      } else {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("credit_balance").eq("user_id", userId).single();
        if (!profile || profile.credit_balance < creditCost) {
          return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile?.credit_balance || 0 }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Build user message — preserve ALL user inputs exactly
    let userText = "";
    if (prompt && typeof prompt === "string") {
      userText = prompt;
    } else if (inputs && typeof inputs === "object") {
      userText = Object.entries(inputs)
        .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== "")
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

    console.log(`AI Tool [${toolType}] for user ${userId}, admin=${userIsAdmin}, freeUse=${isFreeUse}`);

    // Smart routing: OpenAI GPT-4o primary → Lovable AI fallback
    const { result: resultText, modelUsed } = await callAIWithFailover(
      supabaseAdmin,
      config.systemPrompt,
      userContent,
    );

    console.log(`AI Tool [${toolType}] completed with model: ${modelUsed}`);

    // Handle credit deduction
    if (userIsAdmin) {
      console.log("Admin free access - skipping credit deduction");
    } else if (isFreeUse) {
      await recordFreeUse(supabaseAdmin, userId, config.actionLabel);
    } else {
      await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: config.actionLabel,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      result: resultText,
      creditsUsed: (userIsAdmin || isFreeUse) ? 0 : creditCost,
      isFreeUse: isFreeUse || userIsAdmin,
      modelUsed,
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
