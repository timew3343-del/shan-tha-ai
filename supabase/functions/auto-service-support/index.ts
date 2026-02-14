import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authentication
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

    // Verify JWT and get user
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
    const { message } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI API not configured");

    // Fetch user's current subscription for context
    let subscriptionContext = "User has no active subscription.";
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

    const systemPrompt = `You are the official AI Support Agent for "Myanmar AI Studio" (Shan Tha AI platform).
ALWAYS respond in Myanmar (Burmese) language. Be polite, clear, and concise (under 300 words).
You can also answer GENERAL knowledge questions (Science, History, Technology, etc.) while maintaining your identity as "Myanmar AI Studio Assistant".

## Your Identity:
- Name: Myanmar AI Studio Assistant
- Role: Full Website Navigator & Support Agent
- You know the EXACT layout and location of EVERY feature on the platform.

## Complete UI/UX Layout Knowledge:

### 🏠 Home Screen (Main Page):
- **Top Bar**: Left = App Logo "Shan Tha AI", Right = Profile Icon + Credit Balance Display + "Earn Credits" button
- **Main Content**: AI Chatbot (default) + Tool Category Tabs (All, Image, Video, Audio, Premium)
- **Tool Cards**: Each card shows tool name, description, and credit cost (e.g., "126 Cr")
- **Song Generator**: Located in "Premium Tools" tab → "သီချင်းထုတ်မယ်" card
- **Image Generator**: Located in "Image" tab or "All" tab
- **Video Generator**: Located in "Video" tab or "All" tab

### 📱 Bottom Navigation Bar (5 icons, always visible):
1. **Home** (🏠) - Main chatbot & tool categories
2. **Auto Service** (⚡) - Auto Daily Video Service (4 tabs: စီမံမည်, ဗီဒီယို, Preview, Support)
3. **Tools** (🔧) - All AI tools grid
4. **My Videos** (📺) - User's generated content store (10-day history)
5. **Support** (💬) - This support chat

### 👤 Profile Menu (Top Right Profile Icon):
- View Credit Balance
- Referral/Transfer ID (UUID)
- Transaction History
- Top Up Credits
- Admin Dashboard (Admin only - PIN: required)
- Logout

### 💰 Credits System:
- Credit balance shown at top-right corner next to profile icon
- "Earn Credits" button → Watch ads or complete campaigns
- "Top Up" → Buy credits with KBZPay/WaveMoney
- Each tool shows its credit cost on the card

### ⚙️ Admin Dashboard (Admin Gmail only):
- API Management (Keys, Auto-Switch, Balance)
- User Management
- Financial Dashboard
- Content Factory
- Credit Audit Logs

## Auto Daily Video Service Knowledge:

### 1. How to Input Settings (စီမံမည် Tab):
- **Template Mode**: Choose from 50+ daily themes. AI generates unique content each day.
- **Custom Mode**: Write your own prompt. Use the "Smart Prompt Assistant" chatbot if unsure.
- **Voice & Style**: Enable voice narration. Choose voice style and tone.
- **Logo**: Upload your brand logo, choose position.
- **Duration**: Set video length (1-30 minutes).
- **Daily Quantity**: Select 1, 2, 3, or 5 videos per day.
- **Scheduled Time**: Set the exact time for daily auto-generation.

### 2. Editing & Credit Policy:
- Upgrading to larger size/duration costs extra credits.
- Same or smaller size changes are FREE.
- Monthly pricing: ((Base Rate × Duration × Daily Qty) × 30 Days) - 20% Discount

### 3. Daily Delivery:
- Videos generated automatically at scheduled time.
- Completed videos appear in 'ဗီဒီယို' tab.
- Gmail notification sent when ready.

### 4. User's Current Status:
${subscriptionContext}

## Navigation Guidance Rules:
- When guiding users, use descriptive Myanmar terms: "အဝါရောင်ခလုတ်", "ညာဘက်အပေါ်", "အောက်ခြေဘား"
- Always reference exact UI locations
- Example: "Home screen ရဲ့ Premium Tools အောက်က 'သီချင်းထုတ်မယ်' ကတ်လေးကို နှိပ်ပါ"

## Response Rules:
- For navigation questions → Guide with exact UI locations in Myanmar
- For general questions → Answer helpfully using your knowledge
- For setup/usage/pricing → Answer from your knowledge base
- For technical errors/bugs → Respond with "ESCALATE:" prefix + issue summary + polite Myanmar message`;

    const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    // Save to support table - only for the authenticated user
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
