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
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    const { videoUrl, targetLanguage, videoDuration }: CaptionRequest = await req.json();

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "Video URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Caption request: user=${userId}, lang=${targetLanguage}, duration=${videoDuration}s`);

    // Calculate credit cost: first 10s free, then 6 credits per minute
    const { data: costSettings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["credit_cost_caption_per_minute", "caption_free_seconds"]);

    let creditsPerMinute = 6;
    let freeSeconds = 10;

    costSettings?.forEach((s) => {
      if (s.key === "credit_cost_caption_per_minute") creditsPerMinute = parseInt(s.value || "6", 10);
      if (s.key === "caption_free_seconds") freeSeconds = parseInt(s.value || "10", 10);
    });

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
      .in("key", ["replicate_api_token", "gemini_api_key"]);

    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k) => { keyMap[k.key] = k.value || ""; });

    const REPLICATE_API_KEY = keyMap.replicate_api_token || Deno.env.get("REPLICATE_API_KEY");
    const GEMINI_API_KEY = keyMap.gemini_api_key || Deno.env.get("GEMINI_API_KEY");

    if (!REPLICATE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Replicate API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======== STEP 1: Transcribe with Replicate Whisper ========
    console.log("Step 1: Starting Whisper transcription...");

    const whisperResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "4d50797290df275329f202e48c76360b3f22b08d28c65c07c8d445c1eeae2a65",
        input: {
          audio: videoUrl,
          model: "large-v3",
          language: "auto",
          translate: false,
          temperature: 0,
          transcription: "srt",
          suppress_tokens: "-1",
          logprob_threshold: -1,
          no_speech_threshold: 0.6,
          condition_on_previous_text: true,
          compression_ratio_threshold: 2.4,
          temperature_increment_on_fallback: 0.2,
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

    // ======== STEP 2: Translate with Gemini ========
    let translatedSrt = srtContent;
    const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    if (targetLanguage && targetLanguage !== "original") {
      console.log(`Step 2: Translating to ${langName}...`);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

      const translateResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a professional subtitle translator. Translate the following SRT subtitle content to ${langName}. 
IMPORTANT RULES:
1. Keep ALL SRT formatting exactly (numbers, timestamps like "00:00:01,000 --> 00:00:03,000")
2. Only translate the text lines
3. Maintain natural, fluent ${langName} language
4. Do not add any extra text or explanations
5. Return ONLY the translated SRT content

SRT Content to translate:
${srtContent}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (translateResponse.ok) {
        const geminiData = await translateResponse.json();
        const translated = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (translated) {
          translatedSrt = translated.trim();
          console.log(`Translation complete. Output length: ${translatedSrt.length}`);
        }
      } else {
        console.error("Gemini translation failed:", await translateResponse.text());
        // Continue with original transcription
      }
    }

    // ======== STEP 3: Deduct credits ========
    let newBalance = profile.credit_balance;
    if (creditCost > 0) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: creditCost,
        _action: "Video caption generation",
      });
      newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

      // Log to audit
      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId,
        amount: -creditCost,
        credit_type: "caption_generation",
        description: `Caption: ${videoDuration}s video, ${langName} translation`,
      });
    }

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
