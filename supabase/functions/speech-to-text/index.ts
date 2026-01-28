import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface STTRequest {
  audioBase64: string;
  language: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    
    if (claimsError || !claims?.claims?.sub) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    console.log(`User ${userId} requesting speech-to-text`);

    // Check user credits server-side
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch dynamic credit cost from app_settings
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "credit_cost_speech_to_text")
      .maybeSingle();
    
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 5;
    
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

    // Fetch Gemini API key from app_settings (server-side only)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "gemini_api_key")
      .single();

    if (settingsError || !settings?.value) {
      console.error("API key not configured:", settingsError);
      return new Response(
        JSON.stringify({ error: "Speech service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = settings.value;

    // Parse request body - NO apiKey from client
    const { audioBase64, language }: STTRequest = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "Audio data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transcribing audio in ${language} language`);

    // Use Gemini to transcribe audio with server-stored key
    const response = await fetch(
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
                  inlineData: {
                    mimeType: "audio/mp3",
                    data: audioBase64,
                  },
                },
                {
                  text: `Transcribe this audio to text. The audio is in ${language} language. Return only the transcribed text without any additional commentary.`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Deduct credits AFTER successful transcription
    const { error: deductError } = await supabaseAdmin
      .from("profiles")
      .update({ credit_balance: profile.credit_balance - creditCost })
      .eq("user_id", userId);

    if (deductError) {
      console.error("Credit deduction error:", deductError);
    }

    console.log(`Transcription successful for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcribedText,
        language: language,
        creditsUsed: creditCost,
        newBalance: profile.credit_balance - creditCost,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("STT error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
