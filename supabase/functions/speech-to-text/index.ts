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

// Helper function to refund credits
async function refundCredits(supabaseAdmin: any, userId: string, amount: number, reason: string) {
  try {
    const { error } = await supabaseAdmin.rpc("add_user_credits", {
      _user_id: userId,
      _amount: amount,
    });
    if (error) {
      console.error("Failed to refund credits:", error);
    } else {
      console.log(`Refunded ${amount} credits to user ${userId} - Reason: ${reason}`);
    }
  } catch (e) {
    console.error("Refund error:", e);
  }
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`User ${userId} requesting speech-to-text`);

    // Parse and validate request body
    let body: STTRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { audioBase64, language } = body;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Audio data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (audioBase64.length > 26214400) { // ~25MB
      return new Response(
        JSON.stringify({ error: "Audio too large (max 25MB)" }),
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
      console.error("Profile error:", profileError);
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
    const BASE_COST = 5; // Base API cost for speech-to-text
    const creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    
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

    // Use Lovable AI for transcription (faster than Gemini direct)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Speech service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transcribing audio in ${language} language`);

    // Language name mapping for better prompts
    const languageNames: Record<string, string> = {
      'my': 'Myanmar (Burmese)',
      'en': 'English',
      'th': 'Thai',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
    };

    const languageName = languageNames[language] || language;

    // Use Lovable AI Gateway with flash model for speed
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: "mp3"
                }
              },
              {
                type: "text",
                text: `Transcribe this audio to text. The audio is in ${languageName} language. Return ONLY the transcribed text without any additional commentary, explanation, or formatting. If the audio is unclear, transcribe what you can hear.`
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const transcribedText = data.choices?.[0]?.message?.content || "";

    if (!transcribedText) {
      console.error("No transcription in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "No transcription generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits ONLY AFTER successful transcription using secure RPC
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Speech-to-text"
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
      // Transcription was successful, still return it
    }

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
    console.log(`Transcription successful for user ${userId}, new balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcribedText,
        language: language,
        creditsUsed: creditCost,
        newBalance: newBalance,
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
