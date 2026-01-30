import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FaceSwapRequest {
  targetVideo: string; // base64 video
  faceImage: string;   // base64 image
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
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    console.log(`User ${userId} requesting face swap`);

    // Check if face swap is enabled
    const { data: enabledSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "face_swap_enabled")
      .maybeSingle();

    if (enabledSetting?.value === "false") {
      return new Response(
        JSON.stringify({ error: "Face swap feature is currently disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetVideo, faceImage }: FaceSwapRequest = await req.json();

    if (!targetVideo || !faceImage) {
      return new Response(
        JSON.stringify({ error: "Target video and face image are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch credit cost
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "credit_cost_face_swap")
      .maybeSingle();
    
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 15;

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
          error: "ခရက်ဒစ် မလုံလောက်ပါ", 
          required: creditCost,
          balance: profile.credit_balance 
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      console.error("REPLICATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Face swap service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting face swap with Replicate API...");

    // Start face swap prediction
    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "9c76a3a8c2b0e3e7f3e3e3e3e3e3e3e3e3e3e3e3", // face-swap model
        input: {
          target_video: targetVideo,
          source_image: faceImage,
        },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("Replicate start error:", startResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Face swap failed to start: ${startResponse.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startData = await startResponse.json();
    const predictionId = startData.id;

    if (!predictionId) {
      console.error("No prediction ID:", startData);
      return new Response(
        JSON.stringify({ error: "Face swap failed - no prediction ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Face swap started with ID: ${predictionId}`);

    // Poll for completion (max 5 minutes)
    const maxAttempts = 60;
    let resultUrl: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          "Authorization": `Token ${REPLICATE_API_KEY}`,
        },
      });

      if (!pollResponse.ok) {
        console.error("Poll error:", pollResponse.status);
        continue;
      }

      const pollData = await pollResponse.json();
      console.log(`Poll attempt ${attempt + 1}: status = ${pollData.status}`);

      if (pollData.status === "succeeded") {
        resultUrl = pollData.output;
        break;
      }

      if (pollData.status === "failed" || pollData.status === "canceled") {
        console.error("Face swap failed:", pollData.error);
        return new Response(
          JSON.stringify({ 
            error: "Face swap generation failed",
            details: pollData.error 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!resultUrl) {
      console.error("Face swap timed out");
      return new Response(
        JSON.stringify({ error: "Face swap timed out. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits AFTER success
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Face swap"
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
    }

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

    console.log(`Face swap successful for user ${userId}, new balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        video: resultUrl,
        creditsUsed: creditCost,
        newBalance: newBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Face swap error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
