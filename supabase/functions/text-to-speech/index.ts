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
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    
    if (claimsError || !claims?.claims?.sub) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    console.log(`User ${userId} requesting text-to-speech`);

    // Parse and validate request body
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
    const BASE_COST = 2; // Base API cost for text-to-speech
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

    console.log(`Generating TTS for text: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Use Web Speech API on client - deduct credits ONLY after confirming success
    // The actual audio generation happens client-side with Web Speech API
    
    // Deduct credits using secure RPC
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Text-to-speech"
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
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
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("TTS error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
