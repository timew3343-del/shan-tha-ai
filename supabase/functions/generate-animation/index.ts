import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateAnimationRequest {
  prompt: string;
  style?: string;
  duration?: string;
}

// ─── Vertex AI JWT Auth (Placeholder for potential future use) ─────────────────────────────────────
async function getVertexAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })));

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const keyData = base64Decode(pemBody);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );

  const signature = base64url(new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(`${header}.${payload}`))
  ));

  const jwt = `${header}.${payload}.${signature}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    throw new Error(`Token exchange failed: ${tokenResp.status} - ${err}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
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
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    let body: GenerateAnimationRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { prompt, style, duration } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (prompt.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Prompt too long (max 1000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Credit cost ────────────────────────────────────────
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_ai_animation_generation").maybeSingle();

    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      creditCost = Math.ceil(20 * (1 + profitMargin / 100)); // Higher cost for animation
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("credit_balance").eq("user_id", userId).single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Deduct credits before processing
    if (!userIsAdmin) {
      const { error: creditError } = await supabaseAdmin
        .from("profiles")
        .update({ credit_balance: profile.credit_balance - creditCost })
        .eq("user_id", userId);

      if (creditError) {
        console.error("Credit deduction error:", creditError);
        return new Response(
          JSON.stringify({ error: "Failed to deduct credits" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!userIsAdmin && profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: creditCost, balance: profile.credit_balance }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating animation: "${prompt.substring(0, 60)}..." style=${style} duration=${duration}`);

    let generatedAnimationUrl: string | null = null;

    // ─── Animation Generation API (Placeholder) ───────────
    // This section would integrate with an actual Text-to-Animation API.
    // For now, it's a placeholder that simulates success.
    const ANIMATION_API_KEY_PRIMARY = Deno.env.get("ANIMATION_API_KEY_PRIMARY");
    const ANIMATION_API_KEY_SECONDARY = Deno.env.get("ANIMATION_API_KEY_SECONDARY");

    let currentAnimationApiKey = ANIMATION_API_KEY_PRIMARY;
    let animationApiUrl = "https://api.example.com/generate-animation"; // Replace with actual API endpoint

    if (!currentAnimationApiKey) {
      const { data: primaryASetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "animation_api_key_primary").maybeSingle();
      if (primaryASetting?.value) currentAnimationApiKey = primaryASetting.value;
    }

    if (!currentAnimationApiKey && ANIMATION_API_KEY_SECONDARY) {
      const { data: secondaryASetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "animation_api_key_secondary").maybeSingle();
      if (secondaryASetting?.value) currentAnimationApiKey = secondaryASetting.value;
    }

    if (!currentAnimationApiKey) {
      throw new Error("Animation API key not configured.");
    }

    try {
      // Simulate API call
      // const animationResp = await fetch(animationApiUrl, {
      //   method: "POST",
      //   headers: { "Authorization": `Bearer ${currentAnimationApiKey}`, "Content-Type": "application/json" },
      //   body: JSON.stringify({ prompt, style, duration }),
      // });

      // if (animationResp.ok) {
      //   const data = await animationResp.json();
      //   generatedAnimationUrl = data.videoUrl; // Assuming API returns a video URL
      // } else {
      //   console.error("Animation API error:", await animationResp.text());
      //   throw new Error("Failed to generate animation from primary API.");
      // }

      // Placeholder for successful generation
      generatedAnimationUrl = `https://example.com/animations/${userId}-${Date.now()}.mp4`;
      console.log("Animation generated successfully (simulated).");

    } catch (e: any) {
      console.error("Animation generation failed:", e.message);
      return new Response(
        JSON.stringify({ error: `Animation generation failed: ${e.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!generatedAnimationUrl) {
      throw new Error("No animation URL returned.");
    }

    // Save output to user store
    const { data: savedOutput, error: saveError } = await supabaseAdmin
      .from("user_outputs")
      .insert({
        user_id: userId,
        tool_name: "AI Animation",
        output_type: "video",
        output_content: generatedAnimationUrl,
        metadata: { prompt, style, duration, creditsUsed: creditCost },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving animation output:", saveError);
      return new Response(
        JSON.stringify({ error: "Failed to save animation output" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, animationUrl: generatedAnimationUrl, creditsUsed: creditCost, outputId: savedOutput.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Supabase function error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
