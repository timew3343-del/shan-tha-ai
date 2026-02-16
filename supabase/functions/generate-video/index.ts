import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateVideoRequest {
  prompt: string;
  image?: string;
  speechText?: string;
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

function extractBase64Data(dataUrl: string): string {
  if (dataUrl.startsWith("data:")) {
    return dataUrl.split(",")[1];
  }
  return dataUrl;
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Check if user is admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;
    console.log(`User ${userId} requesting video generation, isAdmin=${userIsAdmin}`);

    // Parse and validate request body
    let body: GenerateVideoRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { prompt, image, speechText } = body;

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "ဗီဒီယိုထုတ်ရန် ပုံတစ်ပုံထည့်ရန်လိုအပ်ပါသည်" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (image.length > 20971520) { // ~20MB
      return new Response(
        JSON.stringify({ error: "Image too large (max 20MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (prompt && typeof prompt === "string" && prompt.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Prompt too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get credit cost from admin settings first
    const costKey = speechText?.trim() ? "credit_cost_video_with_speech" : "credit_cost_video_generation";
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", costKey).maybeSingle();
    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      const BASE_COST = speechText?.trim() ? 10 : 7;
      creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    }

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

    console.log(`User ${userId} has ${profile.credit_balance} credits, needs ${creditCost}`);
    
    // Admin bypass: skip credit check
    if (!userIsAdmin && profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ 
          error: "ခရက်ဒစ် မလုံလောက်ပါ", 
          required: creditCost,
          balance: profile.credit_balance 
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prioritize env secret, fallback to DB
    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY") || (() => {
      // Sync fallback check removed for security - use env only
      return null;
    })();
    
    if (!STABILITY_API_KEY) {
      console.error("STABILITY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating video for prompt: "${prompt?.substring(0, 50) || 'no prompt'}..."`);

    try {
      const imageBase64 = extractBase64Data(image);
      const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      
      const formData = new FormData();
      formData.append("image", new Blob([imageBytes], { type: "image/png" }), "image.png");
      formData.append("motion_bucket_id", "127");
      formData.append("cfg_scale", "1.8");

      console.log("Calling Stability AI Image-to-Video API...");
      
      const startResponse = await fetch("https://api.stability.ai/v2beta/image-to-video", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STABILITY_API_KEY}`,
        },
        body: formData,
      });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        console.error("Stability AI start error:", startResponse.status, errorText);
        
        // Auto-enable maintenance mode on payment/balance issues
        if (startResponse.status === 402 || errorText.includes("insufficient") || errorText.includes("balance") || errorText.includes("Payment Required")) {
          console.log("Detected API payment issue - enabling maintenance mode");
          await setMaintenanceMode(supabaseAdmin, true);
          return new Response(
            JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။ API Key များ ငွေဖြည့်ရန် လိုအပ်နေသောကြောင့် ခေတ္တစောင့်ဆိုင်းပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။" }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (startResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startData = await startResponse.json();
      const generationId = startData.id;
      
      if (!generationId) {
        console.error("No generation ID received:", startData);
        return new Response(
          JSON.stringify({ error: "Video generation failed - no ID received" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Video generation started with ID: ${generationId}`);

      // Poll for completion (max 3 minutes)
      const maxAttempts = 36;
      let videoData: string | null = null;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log(`Polling attempt ${attempt + 1}/${maxAttempts}...`);
        
        const resultResponse = await fetch(`https://api.stability.ai/v2beta/image-to-video/result/${generationId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${STABILITY_API_KEY}`,
            "Accept": "video/*",
          },
        });

        if (resultResponse.status === 202) {
          console.log("Video still processing...");
          continue;
        }

        if (resultResponse.status === 200) {
          const videoBuffer = await resultResponse.arrayBuffer();
          const base64Video = btoa(
            new Uint8Array(videoBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          videoData = `data:video/mp4;base64,${base64Video}`;
          console.log("Video generation completed!");
          break;
        }

        const errorText = await resultResponse.text();
        console.error("Polling error:", resultResponse.status, errorText);
        
        if (resultResponse.status === 404) {
          return new Response(
            JSON.stringify({ error: "Video generation failed - not found" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        break;
      }

      if (!videoData) {
        console.error("Video generation timed out or failed");
        return new Response(
          JSON.stringify({ error: "ဗီဒီယိုထုတ်ရာတွင် အချိန်ကုန်သွားပါသည်။ ထပ်မံကြိုးစားပါ။" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deduct credits AFTER success (skip for admin)
      let newBalance = profile.credit_balance;
      if (!userIsAdmin) {
        const { data: deductResult } = await supabaseAdmin
          .rpc("deduct_user_credits", {
            _user_id: userId,
            _amount: creditCost,
            _action: speechText?.trim() ? "Video with speech generation" : "Video generation"
          });
        newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
      } else {
        console.log("Admin free access - skipping credit deduction for video");
      }

      console.log(`Video generated successfully for user ${userId}, new balance: ${newBalance}`);

      return new Response(
        JSON.stringify({
          success: true,
          video: videoData,
          creditsUsed: userIsAdmin ? 0 : creditCost,
          newBalance: newBalance,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (apiError: any) {
      console.error("API Error:", apiError);
      
      // Check if it's a payment-related error
      if (apiError.message?.includes("402") || apiError.message?.includes("payment") || apiError.message?.includes("balance")) {
        await setMaintenanceMode(supabaseAdmin, true);
      }
      
      return new Response(
        JSON.stringify({ error: "API လက်ကျန်ငွေ မလုံလောက်ပါ သို့မဟုတ် API ချိတ်ဆက်မှု ခေတ္တပြတ်တောက်နေပါသည်။" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Generate video error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
