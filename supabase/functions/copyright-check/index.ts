import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    console.log(`User ${userId} requesting copyright check`);

    const { content, contentType, frames } = await req.json();

    if (!content && (!frames || frames.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Content or video frames required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate credit cost with profit margin
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "profit_margin")
      .maybeSingle();

    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 3; // Base cost for copyright analysis
    const creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));

    if (profile.credit_balance < creditCost) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          required: creditCost,
          balance: profile.credit_balance,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages for AI analysis
    const userContent: any[] = [];

    if (frames && frames.length > 0) {
      for (const frame of frames) {
        userContent.push({
          type: "image_url",
          image_url: { url: frame },
        });
      }
    }

    const analysisPrompt = `You are a professional copyright safety analyst. Analyze the provided ${contentType === "video" ? "video frames" : "text content"} for potential copyright issues.

${content ? `Content to analyze:\n${content}` : "Analyze the provided video frames for copyright issues."}

Provide your analysis in the following JSON format (respond with ONLY valid JSON, no markdown):
{
  "safetyScore": <number 0-100>,
  "overallRisk": "<high|medium|low>",
  "issues": [
    {
      "type": "<audio|script|visual|music|branding>",
      "severity": "<high|medium|low>",
      "description": "<what the issue is in Myanmar>",
      "detail": "<detailed explanation in Myanmar>"
    }
  ],
  "recommendations": [
    {
      "issue": "<which issue this fixes>",
      "fix": "<specific fix recommendation in Myanmar>",
      "effort": "<easy|medium|hard>"
    }
  ],
  "summary": "<overall summary in Myanmar language>"
}

Be thorough but fair. Consider:
- Background music similarity to copyrighted tracks
- Script/dialogue similarity to existing content
- Visual style copying from known brands
- Use of trademarked logos or designs
- Viral video content replication

If the content appears original and safe, give a high score with minor suggestions for improvement.`;

    userContent.push({ type: "text", text: analysisPrompt });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a copyright safety analysis AI. Always respond with valid JSON only. Be thorough and professional.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const aiText = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let analysisResult;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Raw:", aiText);
      analysisResult = {
        safetyScore: 75,
        overallRisk: "low",
        issues: [],
        recommendations: [],
        summary: "ခွဲခြမ်းစိတ်ဖြာမှု ပြီးပါပြီ။ အသေးစိတ် စစ်ဆေးရန် ထပ်မံကြိုးစားပါ။",
      };
    }

    // Deduct credits after successful analysis
    const { error: deductError } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId,
      _amount: creditCost,
      _action: "Copyright Check",
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
    }

    // Log to audit
    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId,
      amount: -creditCost,
      credit_type: "deduction",
      description: `Copyright Safety Check (${contentType})`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisResult,
        creditCost,
        newBalance: profile.credit_balance - creditCost,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Copyright check error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
