import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT and get user ID
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      console.error("JWT verification failed:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claims.claims.sub as string;
    console.log(`Authenticated user: ${userId}`);

    // Check maintenance mode
    const { data: maintenanceSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "is_maintenance_mode")
      .maybeSingle();

    if (maintenanceSetting?.value === "true") {
      return new Response(
        JSON.stringify({ success: false, error: "Service is under maintenance. Please try again later." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }

    // Fetch global profit margin and calculate credit cost
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();
    
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 15; // Base API cost for character animation
    const creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));

    // Check user's credit balance
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "User profile not found" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Insufficient credits. Required: ${creditCost}, Available: ${profile.credit_balance}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
      );
    }

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_KEY');
    
    if (!REPLICATE_API_TOKEN) {
      console.error("REPLICATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API configuration missing. Please check your REPLICATE_API_TOKEN." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { video_base64, source_face_base64 } = await req.json();

    if (!video_base64 || !source_face_base64) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing video or source face" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing character animation for user: ${userId}, credit cost: ${creditCost}`);

    // Start Replicate prediction with wan-animate model
    const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait=60",
      },
      body: JSON.stringify({
        version: "d3e72ebfc98f89f86c8a4b8d4f6f77b6a8c1e5a7b3d9c2f1e4a7b0c3d6e9f2a5",
        input: {
          image: source_face_base64,
          prompt: "high quality face animation, realistic movement, smooth transition",
          num_frames: 24,
          fps: 24,
          guidance_scale: 7.5,
          num_inference_steps: 50,
        },
        hardware: "gpu-h100-80gb",
      }),
    });

    if (!predictionResponse.ok) {
      const errorText = await predictionResponse.text();
      console.error("Replicate API error:", errorText);
      
      if (predictionResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "API balance insufficient. Please top up your Replicate account." 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "AI Processing Error: Please check your configuration." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const prediction = await predictionResponse.json();
    console.log("Initial prediction:", prediction.id, prediction.status);

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        },
      });
      
      result = await pollResponse.json();
      console.log(`Poll attempt ${attempts + 1}: status = ${result.status}`);
      attempts++;
    }

    if (result.status === "failed") {
      console.error("Prediction failed:", result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || "AI processing failed" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (result.status !== "succeeded") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Processing timeout. Please try again with a shorter video." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 408 }
      );
    }

    // Deduct credits after successful generation
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Character animation"
    });

    if (deductError) {
      console.error("Failed to deduct credits:", deductError);
      // Still return success since animation was generated, but log the issue
    } else {
      const deductData = deductResult as { success: boolean; new_balance?: number } | null;
      console.log("Credits deducted successfully. New balance:", deductData?.new_balance);
    }

    const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;

    console.log("Animation complete:", videoUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        video_url: videoUrl,
        prediction_id: prediction.id,
        credits_deducted: creditCost,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Character animate error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
