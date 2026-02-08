import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface YouTubeRequest {
  videoId: string;
  language: string;
}

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
    console.log(`User ${userId} requesting YouTube to text`);

    // Parse and validate request body
    let body: YouTubeRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { videoId, language } = body;

    if (!videoId || typeof videoId !== "string") {
      return new Response(
        JSON.stringify({ error: "Video ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate video ID format (YouTube IDs are 11 chars, alphanumeric + _ -)
    if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return new Response(
        JSON.stringify({ error: "Invalid video ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate language
    const validLanguages = ['my', 'en', 'th', 'zh', 'ja', 'ko'];
    const safeLang = validLanguages.includes(language) ? language : 'en';

    // Fetch global profit margin and calculate credit cost
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();
    
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 10; // Base API cost for YouTube-to-text
    const creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transcribing YouTube video: ${videoId}`);

    const languageNames: Record<string, string> = {
      'my': 'Myanmar (Burmese)',
      'en': 'English',
      'th': 'Thai',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
    };

    const languageName = languageNames[safeLang] || 'English';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Use Lovable AI to extract and transcribe
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
            content: `Please transcribe the audio/spoken content from this YouTube video: ${videoUrl}

Output requirements:
1. Transcribe ALL spoken words in the video
2. Output the transcription in ${languageName} language
3. If the video is not in ${languageName}, translate the transcription to ${languageName}
4. Return ONLY the transcribed/translated text
5. Do not include timestamps, speaker labels, or any other metadata
6. Preserve paragraph breaks for readability

If the video cannot be accessed or has no speech, explain why briefly.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const transcribedText = data.choices?.[0]?.message?.content || "";

    if (!transcribedText) {
      return new Response(
        JSON.stringify({ error: "No transcription generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits after success
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "YouTube to text"
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
    }

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
    console.log(`YouTube transcription successful, new balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        text: transcribedText,
        creditsUsed: creditCost,
        newBalance: newBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("YouTube to text error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
