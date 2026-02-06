import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FaceSwapRequest {
  targetVideo: string;
  faceImage: string;
  isLiveCamera?: boolean;
}

async function setMaintenanceMode(supabaseAdmin: any, enabled: boolean) {
  try {
    await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "is_maintenance_mode", value: enabled.toString() }, { onConflict: "key" });
    console.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'} automatically`);
  } catch (e) {
    console.error("Failed to set maintenance mode:", e);
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

    // Check maintenance mode first
    const { data: maintenanceSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "is_maintenance_mode")
      .maybeSingle();
    
    if (maintenanceSetting?.value === "true") {
      return new Response(
        JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။ API Key များ ငွေဖြည့်ရန် လိုအပ်နေသောကြောင့် ခေတ္တစောင့်ဆိုင်းပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const { targetVideo, faceImage, isLiveCamera }: FaceSwapRequest = await req.json();

    if (!targetVideo || !faceImage) {
      return new Response(
        JSON.stringify({ error: "Target video and face image are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch global profit margin and calculate credit cost
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();
    
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 15; // Base API cost for face swap
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
          error: "ခရက်ဒစ် မလုံလောက်ပါ", 
          required: creditCost,
          balance: profile.credit_balance 
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to get API key from DB first, then fallback to env
    const { data: apiKeySetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "replicate_api_token")
      .maybeSingle();
    
    const REPLICATE_API_KEY = apiKeySetting?.value || Deno.env.get("REPLICATE_API_KEY");
    
    if (!REPLICATE_API_KEY) {
      console.error("REPLICATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting face swap with Replicate API...");

    // Use the correct face swap model
    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "cdcbfba9b6dbfe7df5b4e6e8ddfd7c0bce2e2fd7dd63cf8d6ba3d7d16bc2d9fb",
        input: {
          target: targetVideo.startsWith("data:") ? targetVideo : `data:video/mp4;base64,${targetVideo}`,
          source: faceImage.startsWith("data:") ? faceImage : `data:image/png;base64,${faceImage}`,
        },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("Replicate start error:", startResponse.status, errorText);
      
      // Auto-enable maintenance mode on payment issues
      if (startResponse.status === 402 || errorText.includes("insufficient") || errorText.includes("balance") || errorText.includes("Payment Required")) {
        console.log("Detected API payment issue - enabling maintenance mode");
        await setMaintenanceMode(supabaseAdmin, true);
        return new Response(
          JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။ API Key များ ငွေဖြည့်ရန် လိုအပ်နေသောကြောင့် ခေတ္တစောင့်ဆိုင်းပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Face swap failed to start: ${startResponse.status}` }),
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
        headers: { "Authorization": `Token ${REPLICATE_API_KEY}` },
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
        
        // Check for payment-related failures
        if (pollData.error?.includes("402") || pollData.error?.includes("payment") || pollData.error?.includes("balance")) {
          await setMaintenanceMode(supabaseAdmin, true);
        }
        
        return new Response(
          JSON.stringify({ 
            error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။",
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
      _action: isLiveCamera ? "Face swap (live camera)" : "Face swap"
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Face swap error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
