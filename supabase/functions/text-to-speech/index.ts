import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TTSRequest {
  text: string;
  voice: string;
  language: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Parse request body
    let body: TTSRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { text, voice, language } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 10000) {
      return new Response(
        JSON.stringify({ error: "Text too long (max 10000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user credits server-side
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch global profit margin and calculate credit cost
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();
    
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 2;
    const creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    
    if (profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile.credit_balance }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try OpenAI TTS first, then fall back to Web Speech
    const { data: openaiKeySetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "openai_api_key")
      .maybeSingle();

    const { data: openaiEnabledSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "api_enabled_openai")
      .maybeSingle();

    const openaiKey = openaiKeySetting?.value;
    const openaiEnabled = openaiEnabledSetting?.value !== "false";

    // Map voice names to OpenAI voices
    const openaiVoiceMap: Record<string, string> = {
      roger: "onyx", george: "echo", brian: "fable",
      daniel: "onyx", liam: "echo", sarah: "nova",
      laura: "shimmer", jessica: "fable", lily: "nova",
      alice: "alloy",
      // Direct OpenAI voice names
      alloy: "alloy", echo: "echo", fable: "fable",
      onyx: "onyx", nova: "nova", shimmer: "shimmer",
    };

    if (openaiKey && openaiEnabled) {
      console.log("Using OpenAI TTS-1-HD for voice:", voice);
      
      const openaiVoice = openaiVoiceMap[voice] || "nova";
      
      // Normalize Burmese/Unicode text for proper pronunciation
      const normalizedText = text.trim().normalize("NFC");
      
      try {
        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1-hd",
            input: normalizedText,
            voice: openaiVoice,
            response_format: "mp3",
          }),
        });

        if (!ttsResponse.ok) {
          const errText = await ttsResponse.text();
          console.error("OpenAI TTS error:", ttsResponse.status, errText);
          throw new Error(`OpenAI TTS failed: ${ttsResponse.status}`);
        }

        // Successfully generated audio - now deduct credits
        const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
          _user_id: userId,
          _amount: creditCost,
          _action: "Text-to-speech (OpenAI TTS-1-HD)"
        });

        if (deductError) {
          console.error("Credit deduction error:", deductError);
          return new Response(
            JSON.stringify({ error: "Credit deduction failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        // Chunked base64 encoding to prevent stack overflow on large audio
        const bytes = new Uint8Array(audioBuffer);
        const CHUNK_SIZE = 8192;
        let base64Audio = "";
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
          base64Audio += String.fromCharCode(...chunk);
        }
        base64Audio = btoa(base64Audio);
        const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

        return new Response(
          JSON.stringify({
            success: true,
            audioBase64: base64Audio,
            audioFormat: "mp3",
            useWebSpeech: false,
            creditsUsed: creditCost,
            newBalance: newBalance,
            engine: "openai-tts-1",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (openaiError) {
        console.error("OpenAI TTS failed, falling back to Web Speech:", openaiError);
        // Fall through to Web Speech fallback
      }
    }

    // Fallback: Web Speech API (client-side) - deduct credits
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Text-to-speech"
    });

    if (deductError) {
      return new Response(
        JSON.stringify({ error: "Credit deduction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

    return new Response(
      JSON.stringify({
        success: true,
        text: text,
        voice: voice,
        language: language,
        useWebSpeech: true,
        message: "Use Web Speech API for audio generation",
        creditsUsed: creditCost,
        newBalance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("TTS error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
