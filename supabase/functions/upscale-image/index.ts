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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: maintenanceSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "is_maintenance_mode").maybeSingle();
    if (maintenanceSetting?.value === "true") {
      return new Response(JSON.stringify({ error: "စနစ်ကို ခေတ္တပြုပြင်နေပါသည်။" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;
    console.log(`Upscale: user=${userId}`);

    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const creditCost = Math.ceil(1 * (1 + profitMargin / 100));

    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!userIsAdmin && (!profile || profile.credit_balance < creditCost)) {
      return new Response(
        JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: keyRows } = await supabaseAdmin.from("app_settings")
      .select("key, value")
      .in("key", ["REPLICATE_API_KEY_PRIMARY", "REPLICATE_API_KEY_SECONDARY", "replicate_api_token"]);
    const keyMap: Record<string, string> = {};
    keyRows?.forEach((k) => { if (k.value) keyMap[k.key] = k.value; });

    const PRIMARY_KEY = Deno.env.get("REPLICATE_API_KEY_PRIMARY")
      || keyMap.REPLICATE_API_KEY_PRIMARY
      || Deno.env.get("REPLICATE_API_KEY")
      || keyMap.replicate_api_token;
    const SECONDARY_KEY = Deno.env.get("REPLICATE_API_KEY_SECONDARY")
      || keyMap.REPLICATE_API_KEY_SECONDARY;

    if (!PRIMARY_KEY && !SECONDARY_KEY) {
      return new Response(JSON.stringify({ error: "API key မရှိပါ။ Admin ထံ ဆက်သွယ်ပေးပါ။" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callReplicate = (apiKey: string) => fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        input: {
          image: `data:image/png;base64,${imageBase64}`,
          scale: 4,
          face_enhance: true,
        },
      }),
    });

    let activeKey = PRIMARY_KEY || SECONDARY_KEY!;
    let createResponse = await callReplicate(activeKey);
    if (!createResponse.ok && SECONDARY_KEY && activeKey !== SECONDARY_KEY) {
      console.warn("Primary key failed, trying secondary");
      activeKey = SECONDARY_KEY;
      createResponse = await callReplicate(activeKey);
    }

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Replicate create error:", createResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Upscale failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prediction = await createResponse.json();
    let result = prediction;
    for (let i = 0; i < 60 && result.status !== "succeeded" && result.status !== "failed"; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${activeKey}` },
      });
      result = await poll.json();
    }

    if (result.status !== "succeeded") {
      console.error("Upscale failed:", result.error);
      return new Response(JSON.stringify({ error: "Upscale timed out or failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let newBalance = profile?.credit_balance || 0;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits",
        { _user_id: userId, _amount: creditCost, _action: "upscale_image" });
      newBalance = deductResult?.new_balance ?? newBalance;
    }

    try {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: userId, tool_id: "upscale", tool_name: "4K Upscale",
        output_type: "image", file_url: result.output,
      });
    } catch (e) { console.warn("Save output failed:", e); }

    return new Response(
      JSON.stringify({ image: result.output, creditsUsed: userIsAdmin ? 0 : creditCost, newBalance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Upscale error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
