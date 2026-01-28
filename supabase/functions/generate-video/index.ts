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

    if (!prompt || prompt.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
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
        JSON.stringify({ error: "Video generation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating video for prompt: "${prompt.substring(0, 50)}..."`);

    // Build request for video generation using image generation model
    const systemPrompt = `You are an AI that generates images. When the user provides a description, you MUST generate an image based on that description. Do not ask questions or provide text responses - always generate an image directly. If an image is provided, animate or modify it according to the description.`;
    
    const messages: any[] = [
      { role: "system", content: systemPrompt }
    ];
    
    if (image) {
      // If reference image provided, include it with explicit generation instruction
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Generate an animated version of this image with the following motion/action: ${prompt}. Output the generated image directly.` },
          { type: "image_url", image_url: { url: image } }
        ]
      });
    } else {
      // Text-to-video style generation with explicit instruction
      messages.push({
        role: "user",
        content: `Generate an image of: ${prompt}. Make it dynamic and animated-looking with motion blur or action elements. Output the generated image directly.`
      });
    }

    // Call Lovable AI Gateway for image generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
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
        JSON.stringify({ error: "Video generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI Response structure:", JSON.stringify(data, null, 2));
    
    // Extract generated content - check multiple possible locations
    let generatedImage = null;
    const generatedText = data.choices?.[0]?.message?.content;
    
    // Check for images array in message
    if (data.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
      generatedImage = data.choices[0].message.images[0].image_url.url;
    }
    // Check for inline base64 images in content (some models return this way)
    else if (data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      // Check if content is an array with image parts
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image_url" && part.image_url?.url) {
            generatedImage = part.image_url.url;
            break;
          }
          if (part.type === "image" && part.data) {
            generatedImage = `data:image/png;base64,${part.data}`;
            break;
          }
        }
      }
      // Check for base64 image in text content
      else if (typeof content === "string" && content.includes("data:image")) {
        const match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (match) {
          generatedImage = match[0];
        }
      }
    }
    // Check for images at response level
    if (!generatedImage && data.images?.[0]?.url) {
      generatedImage = data.images[0].url;
    }
    
    if (!generatedImage) {
      console.error("No image in response. Full response:", JSON.stringify(data));
      // Return a helpful error with the text response if available
      return new Response(
        JSON.stringify({ 
          error: "ပုံမထုတ်နိုင်ပါ။ ကျေးဇူးပြု၍ prompt ကို ပိုရှင်းအောင် ပြန်ရေးပါ။",
          details: generatedText || "No response from AI"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits using the secure function
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: creditCost,
        _action: speechText?.trim() ? "Video with speech generation" : "Video generation"
      });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
      // Continue anyway since content was generated
    }

    const newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);

    console.log(`Video generated successfully for user ${userId}, new balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        video: generatedImage, // For now, returning animated image
        description: generatedText,
        creditsUsed: creditCost,
        newBalance: newBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Generate video error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
