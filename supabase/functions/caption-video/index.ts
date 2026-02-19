import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CaptionRequest {
  videoUrl: string;
  targetLanguage: string; // "my" | "en" | "th" | "ja"
  videoDuration: number; // in seconds
}

const LANGUAGE_NAMES: Record<string, string> = {
  my: "Myanmar (Burmese)",
  en: "English",
  th: "Thai",
  ja: "Japanese",
};

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

    // Check maintenance mode
    const { data: maintenanceSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "is_maintenance_mode")
      .maybeSingle();

    if (maintenanceSetting?.value === "true") {
      return new Response(
        JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const { videoUrl, targetLanguage, videoDuration }: CaptionRequest = await req.json();

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "Video URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Caption request: user=${userId}, lang=${targetLanguage}, duration=${videoDuration}s`);

    // Fetch global profit margin and calculate credit cost
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();
    
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST_PER_MINUTE = 6; // Base API cost per minute of video
    const creditsPerMinute = Math.ceil(BASE_COST_PER_MINUTE * (1 + profitMargin / 100));
    const freeSeconds = 10;

    const billableSeconds = Math.max(0, videoDuration - freeSeconds);
    const creditCost = billableSeconds > 0 ? Math.ceil((billableSeconds / 60) * creditsPerMinute) : 0;

    console.log(`Credit calculation: billable=${billableSeconds}s, cost=${creditCost} credits`);

    // Check balance
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

    if (creditCost > 0 && profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({
          error: "ခရက်ဒစ် မလုံလောက်ပါ",
          required: creditCost,
          balance: profile.credit_balance,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API keys from DB
    const { data: apiKeys } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["replicate_api_token"]);

    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k) => { keyMap[k.key] = k.value || ""; });

    const REPLICATE_API_KEY = keyMap.replicate_api_token || Deno.env.get("REPLICATE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!REPLICATE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Replicate API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI translation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======== STEP 1: Transcribe with Replicate Whisper ========
    console.log("Step 1: Starting Whisper transcription...");

    const whisperResponse = await fetch("https://api.replicate.com/v1/models/openai/whisper/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          audio: videoUrl,
          model: "large-v3",
          language: "auto",
          translate: false,
          temperature: 0,
          transcription: "srt",
        },
      }),
    });

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text();
      console.error("Whisper start error:", whisperResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Transcription failed to start" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const whisperPrediction = await whisperResponse.json();
    const predictionId = whisperPrediction.id;
    console.log(`Whisper prediction started: ${predictionId}`);

    // Poll for Whisper completion (max 5 minutes)
    let transcriptionResult: any = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));

      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });

      const pollData = await pollResponse.json();
      console.log(`Whisper poll ${attempt + 1}: status=${pollData.status}`);

      if (pollData.status === "succeeded") {
        transcriptionResult = pollData.output;
        break;
      }

      if (pollData.status === "failed" || pollData.status === "canceled") {
        console.error("Whisper failed:", pollData.error);
        return new Response(
          JSON.stringify({ error: "Transcription failed: " + (pollData.error || "Unknown error") }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!transcriptionResult) {
      return new Response(
        JSON.stringify({ error: "Transcription timed out" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract SRT and plain text
    const srtContent = transcriptionResult.transcription || transcriptionResult.srt || "";
    const detectedLanguage = transcriptionResult.detected_language || "unknown";
    console.log(`Transcription complete. Detected language: ${detectedLanguage}, SRT length: ${srtContent.length}`);

    // ======== STEP 2: Translate with OpenAI GPT-4o (primary) or Lovable AI (fallback) ========
    let translatedSrt = srtContent;
    const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    if (targetLanguage && targetLanguage !== "original") {
      console.log(`Step 2: Translating to ${langName}...`);

      const translateMessages = [
        {
          role: "system",
          content: `You are a professional subtitle translator for Myanmaraistudio.com. Translate SRT content accurately.
RULES: Keep ALL SRT formatting (numbers, timestamps). Only translate text lines. Return ONLY translated SRT.`,
        },
        {
          role: "user",
          content: `Translate the following SRT subtitle content to ${langName}:\n\n${srtContent}`,
        },
      ];

      // Try OpenAI GPT-4o first
      const { data: aiSettings } = await supabaseAdmin
        .from("app_settings").select("key, value")
        .in("key", ["openai_api_key", "api_enabled_openai"]);
      const aiMap: Record<string, string> = {};
      aiSettings?.forEach((s: any) => { aiMap[s.key] = s.value; });
      const openaiKey = aiMap["api_enabled_openai"] !== "false" ? aiMap["openai_api_key"] : null;

      let translated = "";
      if (openaiKey) {
        try {
          console.log("Caption translate: trying OpenAI GPT-4o");
          const resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o", messages: translateMessages, temperature: 0.3, max_tokens: 8192 }),
          });
          if (resp.ok) {
            const data = await resp.json();
            translated = data.choices?.[0]?.message?.content?.trim() || "";
            console.log("Caption translate: success with OpenAI GPT-4o");
          } else {
            console.warn("OpenAI translate failed:", resp.status);
          }
        } catch (err: any) {
          console.warn("OpenAI translate error:", err.message);
        }
      }

      // Fallback to Lovable AI
      if (!translated && LOVABLE_API_KEY) {
        console.log("Caption translate: fallback to Lovable AI");
        const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: translateMessages, temperature: 0.3, max_tokens: 8192 }),
        });
        if (translateResponse.ok) {
          const aiData = await translateResponse.json();
          translated = aiData.choices?.[0]?.message?.content?.trim() || "";
        } else {
          const errText = await translateResponse.text();
          console.error("AI translation failed:", translateResponse.status, errText);
        }
      }

      if (translated) {
        translatedSrt = translated;
        console.log(`Translation complete. Output length: ${translatedSrt.length}`);
      }
    }

    // ======== STEP 3: Deduct credits (admin bypass) ========
    // Check admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    let newBalance = profile.credit_balance;
    if (creditCost > 0 && !userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: creditCost,
        _action: "Video caption generation",
      });
      newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId,
        amount: -creditCost,
        credit_type: "caption_generation",
        description: `Caption: ${videoDuration}s video, ${langName} translation`,
      });
    } else if (userIsAdmin) {
      console.log("Admin free access - skipping credit deduction for Caption");
    }

    // Save output to user_outputs
    try {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: userId, tool_id: "caption", tool_name: "AI Caption",
        output_type: "text", content: translatedSrt,
      });
    } catch (e) { console.warn("Failed to save caption output:", e); }

    console.log(`Caption completed for user ${userId}. Credits used: ${creditCost}, new balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        srt: translatedSrt,
        originalSrt: srtContent,
        detectedLanguage,
        translatedTo: langName,
        creditsUsed: creditCost,
        newBalance,
        videoDuration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Caption video error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
