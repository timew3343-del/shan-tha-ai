import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Translate using Gemini API directly (GEMINI_API_KEY)
async function translateWithGeminiDirect(text: string, targetLang: string, apiKey: string): Promise<string | null> {
  try {
    console.log(`[Pro TTS] Translating via Gemini API directly to ${targetLang}...`);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a professional translator. Translate the following text into ${targetLang}. Output ONLY the translated text in ${targetLang} script/characters. No explanations, no notes, no original text.\n\nText to translate:\n${text}`
            }]
          }],
          generationConfig: { temperature: 0.3 },
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Pro TTS] Gemini Direct API error ${res.status}: ${errBody}`);
      return null;
    }
    const data = await res.json();
    const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (translated && translated.length > 0) {
      console.log(`[Pro TTS] Gemini Direct translation SUCCESS: "${translated.substring(0, 100)}..."`);
      return translated;
    }
    return null;
  } catch (e) {
    console.error("[Pro TTS] Gemini Direct translation exception:", e);
    return null;
  }
}

// Translate using Lovable AI Gateway (fallback)
async function translateWithLovableGateway(text: string, targetLang: string, apiKey: string): Promise<string | null> {
  try {
    console.log(`[Pro TTS] Translating via Lovable Gateway to ${targetLang}...`);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "system",
          content: `You are a professional translator. Output ONLY the translated text in ${targetLang} script/characters. No explanations.`
        }, {
          role: "user",
          content: `Translate into ${targetLang}:\n\n${text}`
        }],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Pro TTS] Lovable Gateway error ${res.status}: ${errBody}`);
      return null;
    }
    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (translated && translated.length > 0) {
      console.log(`[Pro TTS] Lovable Gateway translation SUCCESS: "${translated.substring(0, 100)}..."`);
      return translated;
    }
    return null;
  } catch (e) {
    console.error("[Pro TTS] Lovable Gateway translation exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    const body = await req.json();
    const { text, voiceId, language, speed, stability, similarityBoost } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: "Text too long (max 5000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get credit cost
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_pro_tts").maybeSingle();
    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      creditCost = Math.ceil(5 * (1 + profitMargin / 100));
    }

    // Credit check
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!userIsAdmin) {
      if (!profile || profile.credit_balance < creditCost) {
        return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile?.credit_balance || 0 }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Step 1: Translate text to target language
    let finalText = text.trim();
    let wasTranslated = false;
    const targetLang = language || "English";

    console.log(`[Pro TTS] Input: "${finalText.substring(0, 80)}..." | Target: ${targetLang}`);

    // Try GEMINI_API_KEY first (direct), then LOVABLE_API_KEY (gateway)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let translated: string | null = null;

    if (GEMINI_API_KEY) {
      translated = await translateWithGeminiDirect(finalText, targetLang, GEMINI_API_KEY);
    }

    if (!translated && LOVABLE_API_KEY) {
      translated = await translateWithLovableGateway(finalText, targetLang, LOVABLE_API_KEY);
    }

    if (translated) {
      finalText = translated;
      wasTranslated = true;
    } else {
      console.warn("[Pro TTS] All translation methods failed - using original text. Audio may not match target language.");
    }

    // Step 2: ElevenLabs TTS
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ElevenLabs not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const selectedVoiceId = voiceId || "EXAVITQu4vr4xnSDxMaL";
    
    console.log(`[Pro TTS] ElevenLabs: voice=${selectedVoiceId}, textLen=${finalText.length}, translated=${wasTranslated}`);
    
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: finalText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: stability ?? 0.5,
            similarity_boost: similarityBoost ?? 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: speed ?? 1.0,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error("[Pro TTS] ElevenLabs error:", ttsResponse.status, errText);
      const errMsg = ttsResponse.status === 401 
        ? "ElevenLabs API key is invalid or account requires upgrade" 
        : ttsResponse.status === 429 
        ? "ElevenLabs rate limit exceeded, please try again later"
        : "TTS generation failed";
      return new Response(JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduct credits
    let newBalance = profile?.credit_balance || 0;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "Pro TTS (ElevenLabs)"
      });
      newBalance = deductResult?.new_balance ?? (profile!.credit_balance - creditCost);
    } else {
      console.log("[Pro TTS] Admin free access - skipping credit deduction");
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = base64Encode(audioBuffer);

    // Save to user_outputs
    try {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: userId,
        tool_id: "pro-tts",
        tool_name: "Pro Text to Speech",
        output_type: "audio",
        content: wasTranslated ? `[${targetLang}] ${finalText.substring(0, 500)}` : text.substring(0, 500),
      });
    } catch (e) {
      console.warn("[Pro TTS] Failed to save output:", e);
    }

    console.log(`[Pro TTS] SUCCESS - translated=${wasTranslated}, lang=${targetLang}, audioSize=${audioBuffer.byteLength}`);

    return new Response(JSON.stringify({
      success: true,
      audioBase64,
      audioFormat: "mp3",
      translatedText: wasTranslated ? finalText : undefined,
      targetLanguage: targetLang,
      creditsUsed: userIsAdmin ? 0 : creditCost,
      newBalance,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[Pro TTS] Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
