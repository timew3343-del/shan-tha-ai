import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function setMaintenanceMode(supabaseAdmin: any, enabled: boolean) {
  try {
    await supabaseAdmin.from("app_settings").upsert({ key: "is_maintenance_mode", value: enabled.toString() }, { onConflict: "key" });
  } catch (e) { console.error("Failed to set maintenance mode:", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: maintenanceSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "is_maintenance_mode").maybeSingle();
    if (maintenanceSetting?.value === "true") {
      return new Response(JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;

    // Check if user is admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;
    console.log(`User ${userId} requesting face swap, isAdmin=${userIsAdmin}`);

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { targetVideo, faceImage, isLiveCamera } = body;

    if (!targetVideo || !faceImage) {
      return new Response(JSON.stringify({ error: "Target video and face image are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get credit cost from admin settings
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "credit_cost_face_swap").maybeSingle();
    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      creditCost = Math.ceil(15 * (1 + profitMargin / 100));
    }

    // Admin bypass + credit check
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!userIsAdmin && profile.credit_balance < creditCost) {
      return new Response(JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost, balance: profile.credit_balance }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Prioritize env secret over DB for security
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Token ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "cdcbfba9b6dbfe7df5b4e6e8ddfd7c0bce2e2fd7dd63cf8d6ba3d7d16bc2d9fb",
        input: {
          target: targetVideo.startsWith("data:") ? targetVideo : `data:video/mp4;base64,${targetVideo}`,
          source: faceImage.startsWith("data:") ? faceImage : `data:image/png;base64,${faceImage}`,
        },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("Replicate start error:", startResponse.status, errorText);
      if (startResponse.status === 402 || errorText.includes("insufficient")) {
        await setMaintenanceMode(supabaseAdmin, true);
        return new Response(JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: `Face swap failed: ${startResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startData = await startResponse.json();
    const predictionId = startData.id;
    if (!predictionId) {
      return new Response(JSON.stringify({ error: "Face swap failed - no prediction ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let resultUrl: string | null = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });
      const pollData = await pollResponse.json();
      if (pollData.status === "succeeded") { resultUrl = pollData.output; break; }
      if (pollData.status === "failed" || pollData.status === "canceled") {
        return new Response(JSON.stringify({ error: "Face swap failed", details: pollData.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!resultUrl) {
      return new Response(JSON.stringify({ error: "Face swap timed out" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduct credits AFTER success (skip for admin)
    let newBalance = profile.credit_balance;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: isLiveCamera ? "Face swap (live camera)" : "Face swap"
      });
      newBalance = deductResult?.new_balance ?? (profile.credit_balance - creditCost);
    } else {
      console.log("Admin free access - skipping credit deduction for face swap");
    }

    // Save output to user_outputs
    try {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: userId, tool_id: "face_swap", tool_name: "Face Swap",
        output_type: "video", file_url: resultUrl,
      });
    } catch (e) { console.warn("Failed to save face swap output:", e); }

    return new Response(JSON.stringify({ success: true, video: resultUrl, creditsUsed: userIsAdmin ? 0 : creditCost, newBalance }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Face swap error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
