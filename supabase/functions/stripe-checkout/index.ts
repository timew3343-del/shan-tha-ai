import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get Stripe secret key from app_settings
    const { data: stripeSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "stripe_secret_key")
      .maybeSingle();

    if (!stripeSetting?.value || stripeSetting.value.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Stripe is not configured yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripeSecretKey = stripeSetting.value;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { packageName, credits, amountInCents, currency = "usd", successUrl, cancelUrl } = await req.json();

    if (!credits || !amountInCents || !packageName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create Stripe Checkout Session via REST API
    const params = new URLSearchParams();
    params.append("payment_method_types[]", "card");
    params.append("mode", "payment");
    params.append("success_url", successUrl || `${req.headers.get("origin")}/top-up?stripe=success`);
    params.append("cancel_url", cancelUrl || `${req.headers.get("origin")}/top-up?stripe=cancel`);
    params.append("line_items[0][price_data][currency]", currency);
    params.append("line_items[0][price_data][product_data][name]", `${packageName} - ${credits} Credits`);
    params.append("line_items[0][price_data][unit_amount]", String(amountInCents));
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[user_id]", user.id);
    params.append("metadata[credits]", String(credits));
    params.append("metadata[package_name]", packageName);
    params.append("client_reference_id", user.id);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (session.error) {
      console.error("Stripe error:", session.error);
      return new Response(
        JSON.stringify({ success: false, error: session.error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create pending transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount_mmk: 0,
      credits,
      package_name: `${packageName} (Stripe)`,
      status: "pending",
    });

    return new Response(
      JSON.stringify({ success: true, url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
