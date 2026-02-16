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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Check if user is admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;
    console.log(`User ${userId} requesting image generation, isAdmin=${userIsAdmin}`);

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

    // Get credit cost from admin settings first, fallback to profit_margin calculation
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_image_generation").maybeSingle();
    
    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      creditCost = Math.ceil(2 * (1 + profitMargin / 100));
    }

    // Admin bypass + credit check
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("credit_balance").eq("user_id", userId).single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userIsAdmin && profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile.credit_balance }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
    
    if (!LOVABLE_API_KEY && !STABILITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Image generation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating image for prompt: "${prompt.substring(0, 50)}..."`);

    let generatedImage: string | null = null;

    // Strategy 1: Stability AI (most reliable for image generation)
    if (STABILITY_API_KEY && !referenceImage) {
      try {
        console.log("Trying Stability AI for image generation...");
        const fd = new FormData();
        fd.append("prompt", prompt);
        fd.append("output_format", "png");
        fd.append("aspect_ratio", "1:1");

        const stabResp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
          body: fd,
        });

        if (stabResp.ok) {
          const buf = await stabResp.arrayBuffer();
          const base64 = btoa(new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ""));
          generatedImage = `data:image/png;base64,${base64}`;
          console.log("Stability AI image generated successfully");
        } else {
          const errText = await stabResp.text();
          console.warn(`Stability AI failed: ${stabResp.status} - ${errText.substring(0, 200)}`);
        }
      } catch (e: any) {
        console.warn(`Stability AI error: ${e.message}`);
      }
    }

    // Strategy 2: Lovable AI Gateway (Gemini image model) - fallback or for reference images
    if (!generatedImage && LOVABLE_API_KEY) {
      try {
        console.log("Trying Lovable AI Gateway for image generation...");
        const messages: any[] = [];
        if (referenceImage) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: `Generate an image based on this reference: ${prompt}` },
              { type: "image_url", image_url: { url: referenceImage } }
            ]
          });
        } else {
          messages.push({ role: "user", content: `Generate an image: ${prompt}` });
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Lovable AI response keys:", JSON.stringify(Object.keys(data)));
          
          // Try multiple response formats
          const choice = data.choices?.[0]?.message;
          generatedImage = 
            choice?.images?.[0]?.image_url?.url ||
            choice?.images?.[0]?.url ||
            choice?.image_url ||
            choice?.content_parts?.find((p: any) => p.type === "image")?.image_url?.url ||
            null;
          
          // Check if content contains base64 image data
          if (!generatedImage && choice?.content) {
            const content = choice.content;
            if (typeof content === "string" && content.startsWith("data:image")) {
              generatedImage = content;
            }
          }
          
          if (generatedImage) {
            console.log("Lovable AI image generated successfully");
          } else {
            console.warn("Lovable AI returned no parseable image. Response structure:", JSON.stringify(data).substring(0, 500));
          }
        } else {
          const errText = await response.text();
          console.warn(`Lovable AI failed: ${response.status} - ${errText.substring(0, 200)}`);
        }
      } catch (e: any) {
        console.warn(`Lovable AI error: ${e.message}`);
      }
    }

    if (!generatedImage) {
      return new Response(JSON.stringify({ error: "ပုံထုတ်ခြင်း မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduct credits AFTER success (skip for admin)
    let newBalance = profile.credit_balance;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "Image generation"
      });
      newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
    } else {
      console.log("Admin free access - skipping credit deduction for image generation");
    }

    return new Response(
      JSON.stringify({
        success: true,
        image: generatedImage,
        creditsUsed: userIsAdmin ? 0 : creditCost,
        newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
