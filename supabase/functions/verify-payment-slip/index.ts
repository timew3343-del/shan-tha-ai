import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Only admins
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { transactionId, screenshotUrl, expectedAmount, packageName } = await req.json();
    if (!transactionId || !screenshotUrl) {
      return new Response(JSON.stringify({ error: "transactionId and screenshotUrl required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use Lovable AI Gateway (Gemini vision) to analyze the screenshot
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download the screenshot image
    const imgResp = await fetch(screenshotUrl);
    if (!imgResp.ok) {
      return new Response(JSON.stringify({ error: "Cannot fetch screenshot" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const imgBuffer = await imgResp.arrayBuffer();
    const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";

    const prompt = `You are a payment verification AI. Analyze this payment screenshot/slip carefully.

Expected payment details:
- Amount: ${expectedAmount} MMK
- Package: ${packageName}

Determine if this is a VALID payment slip by checking:
1. Is this actually a payment/transfer receipt or screenshot? (not a random image)
2. Does the amount shown match or exceed ${expectedAmount} MMK?
3. Does it look like a legitimate bank transfer, KBZPay, WavePay, or similar payment confirmation?
4. Is the transaction status shown as "Successful" or "Completed"?

Respond in this exact JSON format:
{
  "is_valid": true/false,
  "confidence": 0.0-1.0,
  "detected_amount": "amount found in image or null",
  "detected_service": "KBZPay/WavePay/Bank/Unknown",
  "reason_my": "brief reason in Myanmar language",
  "reason_en": "brief reason in English"
}

Only respond with JSON, no other text.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${contentType};base64,${imgBase64}` } }
          ]
        }],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI verification failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let verification;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      verification = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      verification = null;
    }

    if (!verification) {
      return new Response(JSON.stringify({
        verified: false,
        confidence: 0,
        reason: "AI စစ်ဆေးမှု ရလဒ်ဖတ်၍မရပါ",
        raw: rawContent,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      verified: verification.is_valid === true,
      confidence: verification.confidence || 0,
      detected_amount: verification.detected_amount,
      detected_service: verification.detected_service,
      reason: verification.reason_my || verification.reason_en,
      reason_en: verification.reason_en,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("verify-payment-slip error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
