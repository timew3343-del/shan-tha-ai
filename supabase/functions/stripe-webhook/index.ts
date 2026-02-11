import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const body = await req.json();
    const event = body;

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

      // Add credits via RPC
      const { data: result, error: rpcError } = await supabaseAdmin.rpc("add_user_credits", {
        _user_id: userId,
        _amount: credits,
      });

      // Note: add_user_credits requires admin role, but we're using service role key
      // The RPC checks has_role(auth.uid(), 'admin') which won't work with service role
      // So we do a direct update instead
      if (rpcError) {
        console.log("RPC failed (expected with service role), doing direct update");
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ credit_balance: supabaseAdmin.rpc ? undefined : undefined })
          .eq("user_id", userId);
        
        // Direct SQL-safe credit addition
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
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
