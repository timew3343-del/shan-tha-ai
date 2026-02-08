import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateImageRequest {
  prompt: string;
  referenceImage?: string;
}

// Helper function to refund credits on failure
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
    console.log(`User ${userId} requesting image generation`);

    // Parse and validate request body
    let body: GenerateImageRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { prompt, referenceImage } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (prompt.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Prompt too long (max 5000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (referenceImage && referenceImage.length > 10485760) {
      return new Response(
        JSON.stringify({ error: "Reference image too large (max 10MB)" }),
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
    const BASE_COST = 2; // Base API cost for image generation
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

    // Get Lovable API key (auto-provisioned)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Image generation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating image for prompt: "${prompt.substring(0, 50)}..."`);

    // Build messages array for Lovable AI
    const messages: any[] = [];
    
    if (referenceImage) {
      // If reference image provided, include it for image editing
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: referenceImage } }
        ]
      });
    } else {
      // Text-to-image generation
      messages.push({
        role: "user",
        content: `Generate an image: ${prompt}`
      });
    }

    // Call Lovable AI Gateway with faster flash image model
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: messages,
        modalities: ["image", "text"]
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
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service quota exceeded." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Image generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract generated image from response
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!generatedImage) {
      console.error("No image in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits ONLY AFTER successful generation using secure RPC
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Image generation"
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
      // Image was generated, but credit deduction failed - still return image
    }

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
    console.log(`Image generated successfully for user ${userId}, new balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        image: generatedImage,
        creditsUsed: creditCost,
        newBalance: newBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
