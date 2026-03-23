import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function isAdmin(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return respond({ error: "Invalid token" }, 401);

    const userId = user.id;
    const userIsAdmin = await isAdmin(supabaseAdmin, userId);

    let body: { voiceName: string; audioBase64: string; description?: string };
    try { body = await req.json(); } catch { return respond({ error: "Invalid request body" }, 400); }

    const { voiceName, audioBase64, description } = body;
    if (!voiceName || !audioBase64) return respond({ error: "Voice name and audio file are required" }, 400);

    // Calculate credit cost
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "credit_cost_voice_clone").maybeSingle();
    let creditCost = costSetting?.value ? parseInt(costSetting.value, 10) : 50;

    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
      if (!profile || profile.credit_balance < creditCost) {
        return respond({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }, 402);
      }
      
      // Deduct credits
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ credit_balance: profile.credit_balance - creditCost })
        .eq("user_id", userId);
      
      if (updateError) throw updateError;
    }

    // Get ElevenLabs API Key
    const { data: apiKeySetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "elevenlabs_api_key").maybeSingle();
    const ELEVENLABS_KEY = apiKeySetting?.value;

    if (!ELEVENLABS_KEY) {
      // Refund credits
      if (!userIsAdmin) {
        const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
        await supabaseAdmin.from("profiles").update({ credit_balance: profile.credit_balance + creditCost }).eq("user_id", userId);
      }
      return respond({ error: "ElevenLabs API key not configured" }, 500);
    }

    // Convert base64 to Blob
    const byteCharacters = atob(audioBase64.split(",")[1] || audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { type: "audio/mpeg" });

    // Prepare FormData for ElevenLabs
    const formData = new FormData();
    formData.append("name", voiceName);
    formData.append("files", audioBlob, "sample.mp3");
    if (description) formData.append("description", description);

    console.log("Calling ElevenLabs Add Voice API...");
    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_KEY },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs error:", response.status, errText);
      // Refund credits
      if (!userIsAdmin) {
        const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
        await supabaseAdmin.from("profiles").update({ credit_balance: profile.credit_balance + creditCost }).eq("user_id", userId);
      }
      return respond({ error: "Voice cloning failed. Please try again." }, 500);
    }

    const data = await response.json();
    const voiceId = data.voice_id;

    // Store voice_id in user's profile or a separate voices table
    await supabaseAdmin.from("user_voices").insert({
      user_id: userId,
      voice_id: voiceId,
      voice_name: voiceName,
      provider: "elevenlabs",
      metadata: { description, creditCost }
    });

    return respond({ success: true, voiceId, message: "Voice cloned successfully!" });

  } catch (error: any) {
    console.error("Voice clone error:", error);
    return respond({ error: error.message }, 500);
  }
});
