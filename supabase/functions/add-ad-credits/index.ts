import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default values - will be overridden by database settings
const DEFAULT_AD_REWARD = 5;
const DEFAULT_DAILY_LIMIT = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch dynamic settings from database
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["ad_reward_amount", "daily_ad_limit"]);

    let adRewardAmount = DEFAULT_AD_REWARD;
    let dailyLimit = DEFAULT_DAILY_LIMIT;

    if (settingsData) {
      settingsData.forEach((setting) => {
        if (setting.key === "ad_reward_amount" && setting.value) {
          adRewardAmount = parseInt(setting.value, 10) || DEFAULT_AD_REWARD;
        }
        if (setting.key === "daily_ad_limit" && setting.value) {
          dailyLimit = parseInt(setting.value, 10) || DEFAULT_DAILY_LIMIT;
        }
      });
    }

    console.log(`Using settings: reward=${adRewardAmount}, limit=${dailyLimit}`);

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayLogs, error: logsError } = await supabase
      .from("ad_credit_logs")
      .select("credits_earned")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to check daily limit" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const todayTotal = (todayLogs || []).reduce((sum, log) => sum + (log.credits_earned || 0), 0);

    if (todayTotal >= dailyLimit) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Daily limit reached",
          daily_total: todayTotal,
          limit: dailyLimit
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add credits using SECURITY DEFINER function (bypasses admin check)
    const { data: creditResult, error: creditError } = await supabase.rpc("add_credits_via_service", {
      _user_id: user.id,
      _amount: adRewardAmount,
    });

    if (creditError) {
      console.error("Error adding credits:", creditError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to add credits" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the ad credit
    const { error: logError } = await supabase.from("ad_credit_logs").insert({
      user_id: user.id,
      credits_earned: adRewardAmount,
      source: "adsterra",
    });

    if (logError) {
      console.error("Error logging ad credit:", logError);
    }

    // Add to audit log
    await supabase.from("credit_audit_log").insert({
      user_id: user.id,
      amount: adRewardAmount,
      credit_type: "ad_reward",
      description: "Adsterra Social Bar ad view reward",
    });

    console.log(`Added ${adRewardAmount} ad credits to user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        credits_added: adRewardAmount,
        daily_total: todayTotal + adRewardAmount,
        limit: dailyLimit
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in add-ad-credits:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
