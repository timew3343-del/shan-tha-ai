import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get webhook secret from app_settings
    const { data: webhookSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "stripe_webhook_secret")
      .maybeSingle();

    const webhookSecret = webhookSetting?.value;

    // Get raw body for signature verification
    const body = await req.text();
    let event: any;

    if (webhookSecret && webhookSecret.length > 5) {
      // Verify signature using Stripe library
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        console.error("Missing stripe-signature header");
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
          httpClient: Stripe.createFetchHttpClient(),
        });
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        console.log("✅ Webhook signature verified successfully");
      } catch (err: any) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
      // Fallback: no webhook secret configured yet
      console.warn("⚠️ No webhook secret configured - processing without signature verification");
      event = JSON.parse(body);
    }

    console.log("Stripe webhook event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id || session.client_reference_id;
      const credits = parseInt(session.metadata?.credits || "0", 10);
      const packageName = session.metadata?.package_name || "Stripe Purchase";

      if (!userId || !credits) {
        console.error("Missing userId or credits in webhook metadata");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Adding ${credits} credits to user ${userId}`);

      // Direct credit addition using service role
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credit_balance")
        .eq("user_id", userId)
        .single();

      if (profile) {
        await supabaseAdmin
          .from("profiles")
          .update({ credit_balance: profile.credit_balance + credits, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      }

      // Update transaction status
      await supabaseAdmin
        .from("transactions")
        .update({ status: "success" })
        .eq("user_id", userId)
        .eq("status", "pending")
        .like("package_name", `%Stripe%`)
        .order("created_at", { ascending: false })
        .limit(1);

      // Audit log
      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId,
        amount: credits,
        credit_type: "purchased",
        description: `Stripe: ${packageName}`,
      });

      console.log(`Successfully added ${credits} credits to ${userId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
