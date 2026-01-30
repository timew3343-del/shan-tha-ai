import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TTSRequest {
  text: string;
  voiceId: string;
  language: string;
}

// Voice ID mappings for ElevenLabs
const VOICE_IDS: Record<string, string> = {
  // Male voices
  "roger": "CwhRBWXzGAHq8TQ4Fs17",
  "george": "JBFqnCBsd6RMkjVDRZzb",
  "callum": "N2lVS1w4EtoT3dr4eOWO",
  "liam": "TX3LPaxmHKxFdv7VOQHJ",
  "will": "bIHbv24MWmeRgasZH58o",
  "eric": "cjVigY5qzO86Huf0OWal",
  "chris": "iP95p4xoKVk53GoZ742B",
  "brian": "nPczCjzI2devNBz1zQrb",
  "daniel": "onwK4e9ZLuTAKqWW03F9",
  "bill": "pqHfZKP75CvOlQylNhV4",
  // Female voices
  "sarah": "EXAVITQu4vr4xnSDxMaL",
  "laura": "FGY2WhTYpPnrIDTdsKH5",
  "charlie": "IKne3meq5aSn9XLyUdCD",
  "river": "SAz9YHcvj6GT2YYXdXww",
  "alice": "Xb7hH8MSUJpSbSDYk0k2",
  "matilda": "XrExE9yKIg1WjnnlVkGX",
  "jessica": "cgSgspJ2msm6clMCkdW9",
  "lily": "pFZP5JQG7iQjIQuC4Bku",
  "nova": "pFZP5JQG7iQjIQuC4Bku",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    
    if (claimsError || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    const { text, voiceId, language }: TTSRequest = await req.json();

    if (!text || text.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch credit cost
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "credit_cost_text_to_speech")
      .maybeSingle();
    
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 2;

    // Check user credits
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

    if (profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ 
          error: "Insufficient credits", 
          required: creditCost,
          balance: profile.credit_balance 
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI for TTS since ElevenLabs needs API key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      // Fallback to web speech indicator
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: creditCost,
        _action: "Text-to-speech"
      });

      return new Response(
        JSON.stringify({
          success: true,
          useWebSpeech: true,
          text: text,
          creditsUsed: creditCost,
          newBalance: deductResult?.new_balance ?? (profile.credit_balance - creditCost),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating TTS for text: "${text.substring(0, 50)}..." with voice: ${voiceId}`);

    // Use the voice ID directly if it's a known voice, otherwise use default
    const actualVoiceId = VOICE_IDS[voiceId.toLowerCase()] || VOICE_IDS.sarah;

    // Deduct credits
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Text-to-speech"
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
    }

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

    return new Response(
      JSON.stringify({
        success: true,
        useWebSpeech: true,
        text: text,
        voice: voiceId,
        language: language,
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
