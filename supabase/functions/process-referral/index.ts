import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REFERRAL_REWARD = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
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

    const { referral_code, new_user_id } = await req.json();

    if (!referral_code || !new_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is the new user
    if (user.id !== new_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "User mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the referral code
    const { data: refCode, error: refError } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("code", referral_code)
      .limit(1)
      .maybeSingle();

    if (refError || !refCode) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid referral code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Can't refer yourself
    if (refCode.user_id === new_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot use own referral code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already used by this user
    const { data: existingUse } = await supabase
      .from("referral_uses")
      .select("id")
      .eq("used_by_user_id", new_user_id)
      .eq("code_id", refCode.id)
      .maybeSingle();

    if (existingUse) {
      return new Response(
        JSON.stringify({ success: false, error: "Already used this referral" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Award credits using SECURITY DEFINER function (bypasses protect_credit_balance trigger)
    await supabase.rpc("add_credits_via_service", { _user_id: new_user_id, _amount: REFERRAL_REWARD });
    await supabase.rpc("add_credits_via_service", { _user_id: refCode.user_id, _amount: REFERRAL_REWARD });

    // Record the referral use
    await supabase.from("referral_uses").insert({
      code_id: refCode.id,
      used_by_user_id: new_user_id,
      credits_awarded: REFERRAL_REWARD,
    });

    // Update referral code stats
    await supabase
      .from("referral_codes")
      .update({
        uses_count: refCode.uses_count + 1,
        credits_earned: refCode.credits_earned + REFERRAL_REWARD,
      })
      .eq("id", refCode.id);

    // Audit logs
    await supabase.from("credit_audit_log").insert([
      {
        user_id: new_user_id,
        amount: REFERRAL_REWARD,
        credit_type: "referral_bonus",
        description: `Referral signup bonus from ${referral_code}`,
      },
      {
        user_id: refCode.user_id,
        amount: REFERRAL_REWARD,
        credit_type: "referral_reward",
        description: `Referral reward: new user signed up with ${referral_code}`,
      },
    ]);

    console.log(`Referral processed: ${referral_code}, new_user: ${new_user_id}, referrer: ${refCode.user_id}`);

    return new Response(
      JSON.stringify({ success: true, credits_awarded: REFERRAL_REWARD }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in process-referral:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
