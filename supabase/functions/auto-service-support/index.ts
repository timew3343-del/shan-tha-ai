import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI API not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch user's current subscription for context
    let subscriptionContext = "User has no active subscription.";
    if (userId) {
      const { data: sub } = await supabaseAdmin
        .from("auto_service_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        subscriptionContext = `User has an ACTIVE subscription:
- Template: ${sub.template_category}
- Language: ${sub.target_language}
- Credits Paid: ${sub.credits_paid}
- Started: ${sub.starts_at}
- Expires: ${sub.expires_at}`;
      }
    }

    const systemPrompt = `You are the official AI Support Agent for the "Auto Daily Video Service" on Shan Tha AI platform.
ALWAYS respond in Myanmar (Burmese) language. Be polite, clear, and concise (under 200 words).

## Your Knowledge Base:

### 1. How to Input Settings (စီမံမည် Tab):
- **Template Mode**: Choose from 50+ daily themes (Motivational, Buddhist Dhamma, News, etc.). AI generates unique content each day.
- **Custom Mode**: Write your own prompt. Use the "Smart Prompt Assistant" chatbot if unsure.
- **Voice & Style**: Enable voice narration. Choose voice style (Professional, Calm, etc.) and tone (Deep Male, Mid Female, etc.).
- **Logo**: Upload your brand logo, choose position (Top-Left, Top-Right, Bottom-Left, Bottom-Right).
- **Duration**: Set video length (1-30 minutes) using the slider.
- **Daily Quantity**: Select 1, 2, 3, or 5 videos per day. AI generates UNIQUE content for each video.
- **Scheduled Time**: Set the exact time for daily auto-generation.

### 2. Editing & Credit Policy (CRITICAL - explain exactly):
- "သင်သည် ပထမဝယ်ယူထားသော Video Size/Duration ထက် ပိုကြီးသော ဆိုဒ်သို့ ပြောင်းလဲလိုပါက ခရက်ဒစ် ထပ်မံပေးချေရပါမည်။"
- "အကယ်၍ ဆိုဒ်တူညီခြင်း (သို့မဟုတ်) ပို၍သေးငယ်သော ဆိုဒ်သို့ ပြောင်းလဲခြင်းဖြစ်ပါက ခရက်ဒစ် ထပ်မံပေးချေရန် မလိုဘဲ အခမဲ့ ပြောင်းလဲနိုင်ပါသည်။"
- Monthly pricing: ((Base Rate × Duration × Daily Qty) × 30 Days) - 20% Discount

### 3. Daily Delivery:
- Videos are generated automatically at the user's scheduled time.
- Completed videos appear in the 'ဗီဒီယို' (Videos) tab.
- Gmail notification with download link is sent when videos are ready.
- AI uses multi-API failover (Suno, Gemini, etc.) to ensure 100% daily success.

### 4. User's Current Status:
${subscriptionContext}

## Response Rules:
- For general questions about setup, usage, templates, pricing → Answer helpfully in Myanmar
- For technical errors, bugs, video generation failures → Respond with "ESCALATE:" prefix followed by the issue summary, then provide a polite Myanmar message saying their issue has been forwarded to the owner
- Always reference the user's current subscription status when relevant`;

    const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.5,
      }),
    });

    if (!classifyResponse.ok) {
      const errText = await classifyResponse.text();
      throw new Error(`AI error: ${classifyResponse.status} ${errText}`);
    }

    const aiData = await classifyResponse.json();
    const aiResponse = aiData.choices?.[0]?.message?.content || "ဆက်သွယ်မှု မအောင်မြင်ပါ";

    const isEscalated = aiResponse.startsWith("ESCALATE:");
    const cleanResponse = isEscalated ? aiResponse.replace("ESCALATE:", "").trim() : aiResponse;

    // Save to support table
    await supabaseAdmin.from("auto_service_support").insert({
      user_id: userId,
      message,
      ai_response: cleanResponse,
      is_escalated: isEscalated,
      issue_type: isEscalated ? "technical" : "general",
      status: isEscalated ? "escalated" : "resolved",
    });

    return new Response(JSON.stringify({ response: cleanResponse, escalated: isEscalated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Support error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
