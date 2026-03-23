import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateImageRequest {
  prompt: string;
  referenceImage?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
}

// ─── Vertex AI JWT Auth ─────────────────────────────────────
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

  // Import RSA private key
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

  // Exchange JWT for access token
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

// ─── Aspect ratio to Vertex resolution ──────────────────────
function getVertexResolution(aspectRatio: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "3:4": { width: 896, height: 1280 },
    "4:3": { width: 1280, height: 896 },
    "9:16": { width: 768, height: 1408 },
    "16:9": { width: 1408, height: 768 },
  };
  return map[aspectRatio] || map["1:1"];
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

    let body: GenerateImageRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { prompt, referenceImage, aspectRatio } = body;
    const requestedAspectRatio = aspectRatio || "1:1";

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

    // ─── Credit cost ────────────────────────────────────────
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

    // ─── Prompt enhancement (short prompts) ─────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let finalPrompt = prompt.trim();
    const lineCount = finalPrompt.split("\n").filter(l => l.trim()).length;
    const isDetailedPrompt = lineCount >= 3 || finalPrompt.length >= 200;

    if (!isDetailedPrompt && LOVABLE_API_KEY) {
      try {
        console.log(`Short prompt (${finalPrompt.length} chars), enhancing...`);
        const enhanceResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are an expert image prompt engineer. Given a short description, expand it into a detailed, vivid image generation prompt. Include art style, lighting, composition, color palette, and mood details. Output ONLY the enhanced prompt, nothing else. Max 300 words." },
              { role: "user", content: finalPrompt },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        });
        if (enhanceResp.ok) {
          const d = await enhanceResp.json();
          const enhanced = d.choices?.[0]?.message?.content?.trim();
          if (enhanced && enhanced.length > finalPrompt.length) {
            finalPrompt = enhanced;
          }
        }
      } catch (e: any) {
        console.warn(`Prompt enhancement failed: ${e.message}`);
      }
    }

    console.log(`Generating image: "${finalPrompt.substring(0, 60)}..." aspect=${requestedAspectRatio}`);

    let generatedImage: string | null = null;

    // ─── Strategy 1: Vertex AI Imagen 4 (PRIMARY) ───────────
    // Check env secret first, then app_settings (admin-uploaded JSON)
    let VERTEX_SA_PRIMARY = Deno.env.get("VERTEX_AI_SERVICE_ACCOUNT_PRIMARY");
    if (!VERTEX_SA_PRIMARY) {
      const { data: primaryVSetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "vertex_ai_service_account_primary").maybeSingle();
      if (primaryVSetting?.value) VERTEX_SA_PRIMARY = primaryVSetting.value;
    }

    let VERTEX_SA_SECONDARY = Deno.env.get("VERTEX_AI_SERVICE_ACCOUNT_SECONDARY");
    if (!VERTEX_SA_SECONDARY) {
      const { data: secondaryVSetting } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "vertex_ai_service_account_secondary").maybeSingle();
      if (secondaryVSetting?.value) VERTEX_SA_SECONDARY = secondaryVSetting.value;
    }
    if (VERTEX_SA_PRIMARY || VERTEX_SA_SECONDARY) {
      try {
        console.log("Trying Vertex AI Imagen 4 (Primary)...");
        let currentVertexSA = VERTEX_SA_PRIMARY;
        let sa = JSON.parse(currentVertexSA);
        let accessToken = await getVertexAccessToken(currentVertexSA);
        let projectId = sa.project_id;
        let location = "us-central1";
        let model = "imagen-4.0-generate-001";
        let endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

        const resolution = getVertexResolution(requestedAspectRatio);
        const requestBody: any = {
          instances: [{ prompt: finalPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: requestedAspectRatio,
            outputOptions: { mimeType: "image/png" },
          },
        };

        // Add reference image if provided
        if (referenceImage) {
          const b64 = referenceImage.includes(",") ? referenceImage.split(",")[1] : referenceImage;
          requestBody.instances[0].image = { bytesBase64Encoded: b64 };
        }

        const vertexResp = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        if (vertexResp.ok) {
          const data = await vertexResp.json();
          const b64Image = data.predictions?.[0]?.bytesBase64Encoded;
          if (b64Image) {
            generatedImage = `data:image/png;base64,${b64Image}`;
            console.log("Vertex AI Imagen 4 image generated successfully");
          } else {
            console.warn("Vertex AI returned no image data:", JSON.stringify(data));
          }
        } else if (VERTEX_SA_SECONDARY) {
          console.warn("Primary Vertex AI Imagen 4 failed, trying secondary...");
          currentVertexSA = VERTEX_SA_SECONDARY;
          sa = JSON.parse(currentVertexSA);
          accessToken = await getVertexAccessToken(currentVertexSA);
          projectId = sa.project_id;
          endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

          const secondaryVertexResp = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (secondaryVertexResp.ok) {
            const data = await secondaryVertexResp.json();
            const b64Image = data.predictions?.[0]?.bytesBase64Encoded;
            if (b64Image) {
              generatedImage = `data:image/png;base64,${b64Image}`;
              console.log("Secondary Vertex AI Imagen 4 image generated successfully");
            } else {
              console.warn("Secondary Vertex AI returned no image data:", JSON.stringify(data));
            }
          } else {
            console.error("Secondary Vertex AI Imagen 4 failed:", secondaryVertexResp.status, await secondaryVertexResp.text());
          }
        } else {
          const errText = await vertexResp.text();
          console.warn(`Vertex AI failed: ${vertexResp.status} - ${errText.substring(0, 300)}`);
        }
      } catch (e: any) {
        console.warn(`Vertex AI error: ${e.message}`);
      }
    }

    // ─── Strategy 2: Stability AI (BACKUP) ──────────────────
    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
    if (!generatedImage && STABILITY_API_KEY) {
      try {
        console.log("Falling back to Stability AI...");
        const fd = new FormData();
        fd.append("prompt", finalPrompt);
        fd.append("output_format", "png");
        fd.append("aspect_ratio", requestedAspectRatio);

        if (referenceImage) {
          const base64Data = referenceImage.includes(",") ? referenceImage.split(",")[1] : referenceImage;
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const blob = new Blob([binaryData], { type: "image/png" });
          fd.append("image", blob, "reference.png");
          fd.append("mode", "image-to-image");
          fd.append("strength", "0.65");
        }

        const stabResp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
          body: fd,
        });

        if (stabResp.ok) {
          const buf = await stabResp.arrayBuffer();
          const base64 = btoa(new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ""));
          generatedImage = `data:image/png;base64,${base64}`;
          console.log("Stability AI image generated successfully (fallback)");
        } else {
          const errText = await stabResp.text();
          console.warn(`Stability AI failed: ${stabResp.status} - ${errText.substring(0, 200)}`);
        }
      } catch (e: any) {
        console.warn(`Stability AI error: ${e.message}`);
      }
    }

    // ─── Strategy 3: Lovable AI Gateway (last resort) ───────
    if (!generatedImage && LOVABLE_API_KEY) {
      try {
        console.log("Falling back to Lovable AI Gateway...");
        const messages: any[] = [];
        if (referenceImage) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: `Generate an image based on this reference: ${finalPrompt}` },
              { type: "image_url", image_url: { url: referenceImage } },
            ],
          });
        } else {
          messages.push({ role: "user", content: `Generate an image: ${finalPrompt}` });
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages, modalities: ["image", "text"] }),
        });

        if (response.ok) {
          const data = await response.json();
          const choice = data.choices?.[0]?.message;
          generatedImage =
            choice?.images?.[0]?.image_url?.url ||
            choice?.images?.[0]?.url ||
            choice?.image_url ||
            choice?.content_parts?.find((p: any) => p.type === "image")?.image_url?.url ||
            null;
          if (!generatedImage && choice?.content && typeof choice.content === "string" && choice.content.startsWith("data:image")) {
            generatedImage = choice.content;
          }
          if (generatedImage) console.log("Lovable AI image generated (last resort)");
        }
      } catch (e: any) {
        console.warn(`Lovable AI error: ${e.message}`);
      }
    }

    if (!generatedImage) {
      return new Response(JSON.stringify({ error: "ပုံထုတ်ခြင်း မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Deduct credits ─────────────────────────────────────
    let newBalance = profile.credit_balance;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: "Image generation",
      });
      newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
    }

    // Save output to user store
    if (generatedImage) {
      const { error: saveError } = await supabaseAdmin
        .from("user_outputs")
        .insert({
          user_id: userId,
          tool_name: "image-generation",
          output_type: "image",
          output_url: generatedImage, // Assuming generatedImage is a URL or can be stored directly
          metadata: { prompt: finalPrompt, aspectRatio: requestedAspectRatio, referenceImage: referenceImage ? true : false },
          credits_used: creditCost,
        });

      if (saveError) {
        console.error("Error saving user output:", saveError);
        // Continue even if saving fails, but log the error
      }
    }

    return new Response(
        JSON.stringify({ generatedImage: generatedImage, creditsUsed: creditCost }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  } catch (error: any) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
