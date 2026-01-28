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

// Convert base64 to proper format for Stability API
function extractBase64Data(dataUrl: string): string {
  if (dataUrl.startsWith("data:")) {
    return dataUrl.split(",")[1];
  }
  return dataUrl;
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
    console.log(`User ${userId} requesting video generation`);

    // Parse request body
    const { prompt, image, speechText }: GenerateVideoRequest = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ error: "ဗီဒီယိုထုတ်ရန် ပုံတစ်ပုံထည့်ရန်လိုအပ်ပါသည်" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which credit cost to use based on speechText
    const costKey = speechText?.trim() ? "credit_cost_video_with_speech" : "credit_cost_video_generation";
    
    // Fetch dynamic credit cost from app_settings
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", costKey)
      .maybeSingle();
    
    const defaultCost = speechText?.trim() ? 10 : 7;
    const creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : defaultCost;

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

    console.log(`User ${userId} has ${profile.credit_balance} credits, needs ${creditCost}`);
    
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

    // Deduct credits FIRST
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: creditCost,
        _action: speechText?.trim() ? "Video with speech generation" : "Video generation"
      });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
      return new Response(
        JSON.stringify({ error: "Credit deduction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deducted ${creditCost} credits from user ${userId}`);

    // Get Stability API key
    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
    if (!STABILITY_API_KEY) {
      console.error("STABILITY_API_KEY not configured");
      // Refund credits since we can't proceed
      await refundCredits(supabaseAdmin, userId, creditCost, "API key not configured");
      return new Response(
        JSON.stringify({ error: "Video generation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating video for prompt: "${prompt?.substring(0, 50) || 'no prompt'}..."`);

    try {
      // Step 1: Start video generation with Stability AI Image-to-Video API
      const imageBase64 = extractBase64Data(image);
      const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      
      // Create form data for the request
      const formData = new FormData();
      formData.append("image", new Blob([imageBytes], { type: "image/png" }), "image.png");
      if (prompt?.trim()) {
        formData.append("motion_bucket_id", "127");
        formData.append("cfg_scale", "1.8");
      }

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
        
        // Refund credits on API error
        await refundCredits(supabaseAdmin, userId, creditCost, `Stability API error: ${startResponse.status}`);
        
        // Check for insufficient credits error
        if (startResponse.status === 402 || errorText.includes("insufficient") || errorText.includes("balance")) {
          return new Response(
            JSON.stringify({ 
              error: "Stability AI Credit မလုံလောက်ပါ - ကျေးဇူးပြု၍ Credit ထပ်ဖြည့်ပါ",
              refunded: true,
              creditsRefunded: creditCost
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (startResponse.status === 429) {
          return new Response(
            JSON.stringify({ 
              error: "Rate limit exceeded. Please try again later.",
              refunded: true,
              creditsRefunded: creditCost
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            error: "Video generation failed to start",
            refunded: true,
            creditsRefunded: creditCost
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startData = await startResponse.json();
      const generationId = startData.id;
      
      if (!generationId) {
        console.error("No generation ID received:", startData);
        await refundCredits(supabaseAdmin, userId, creditCost, "No generation ID received");
        return new Response(
          JSON.stringify({ 
            error: "Video generation failed - no ID received",
            refunded: true,
            creditsRefunded: creditCost
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Video generation started with ID: ${generationId}`);

      // Step 2: Poll for completion (max 3 minutes)
      const maxAttempts = 36; // 36 * 5 seconds = 180 seconds = 3 minutes
      let videoData: string | null = null;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Wait 5 seconds between polls
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
          // Still processing
          console.log("Video still processing...");
          continue;
        }

        if (resultResponse.status === 200) {
          // Video is ready
          const videoBuffer = await resultResponse.arrayBuffer();
          const base64Video = btoa(
            new Uint8Array(videoBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          videoData = `data:video/mp4;base64,${base64Video}`;
          console.log("Video generation completed!");
          break;
        }

        // Error occurred
        const errorText = await resultResponse.text();
        console.error("Polling error:", resultResponse.status, errorText);
        
        if (resultResponse.status === 404) {
          await refundCredits(supabaseAdmin, userId, creditCost, "Generation not found");
          return new Response(
            JSON.stringify({ 
              error: "Video generation failed - not found",
              refunded: true,
              creditsRefunded: creditCost
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        break;
      }

      if (!videoData) {
        console.error("Video generation timed out or failed");
        await refundCredits(supabaseAdmin, userId, creditCost, "Generation timed out");
        return new Response(
          JSON.stringify({ 
            error: "ဗီဒီယိုထုတ်ရာတွင် အချိန်ကုန်သွားပါသည်။ ထပ်မံကြိုးစားပါ။",
            refunded: true,
            creditsRefunded: creditCost
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

      console.log(`Video generated successfully for user ${userId}, new balance: ${newBalance}`);

      return new Response(
        JSON.stringify({
          success: true,
          video: videoData,
          creditsUsed: creditCost,
          newBalance: newBalance,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    } catch (apiError: any) {
      console.error("API Error:", apiError);
      // Refund credits on any API error
      await refundCredits(supabaseAdmin, userId, creditCost, `API error: ${apiError.message}`);
      return new Response(
        JSON.stringify({ 
          error: apiError.message || "Video generation failed",
          refunded: true,
          creditsRefunded: creditCost
        }),
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
