import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 10;
const CREDITS_PER_AD = 5;

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

    if (todayTotal >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Daily limit reached",
          daily_total: todayTotal,
          limit: DAILY_LIMIT
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add credits using secure RPC
    const { data: creditResult, error: creditError } = await supabase.rpc("add_user_credits", {
      _user_id: user.id,
      _amount: CREDITS_PER_AD,
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
      credits_earned: CREDITS_PER_AD,
      source: "adsterra",
    });

    if (logError) {
      console.error("Error logging ad credit:", logError);
    }

    // Add to audit log
    await supabase.from("credit_audit_log").insert({
      user_id: user.id,
      amount: CREDITS_PER_AD,
      credit_type: "ad_reward",
      description: "Adsterra Social Bar ad view reward",
    });

    console.log(`Added ${CREDITS_PER_AD} ad credits to user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        credits_added: CREDITS_PER_AD,
        daily_total: todayTotal + CREDITS_PER_AD,
        limit: DAILY_LIMIT
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
