import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TTSRequest {
  text: string;
  voice: string;
  language: string;
  apiKey: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, voice, language, apiKey }: TTSRequest = await req.json();

    if (!text || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating TTS for text: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Use Google Cloud Text-to-Speech API via Gemini key
    // For now, using a simpler approach with browser-compatible audio generation
    // In production, integrate with Google Cloud TTS or ElevenLabs

    // Simulate TTS generation with a placeholder approach
    // The actual implementation would call Google Cloud TTS API
    const ttsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate audio speech for this text: "${text}". Since you cannot generate audio directly, please acknowledge that you received the text and it contains ${text.length} characters in ${language} language.`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`API error: ${ttsResponse.status}`);
    }

    // For demo purposes, we'll use a text-to-speech service
    // In production, replace with actual TTS API integration
    
    // Use browser's built-in TTS as fallback - return a special response
    // that tells the frontend to use Web Speech API
    return new Response(
      JSON.stringify({
        success: true,
        text: text,
        voice: voice,
        language: language,
        useWebSpeech: true,
        message: "Use Web Speech API for audio generation",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("TTS error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
