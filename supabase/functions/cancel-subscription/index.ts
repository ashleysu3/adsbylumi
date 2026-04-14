import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const user = userData.user;
    const userEmail = user.email;
    if (!userEmail) throw new Error("No email on user account");

    logStep("User authenticated", { userId: user.id, email: userEmail });

    const { at_period_end = true } = await req.json().catch(() => ({}));

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for your account");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Find active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });

    // Also check trialing
    const trialSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 5,
    });

    const allSubs = [...subscriptions.data, ...trialSubs.data];

    if (allSubs.length === 0) {
      throw new Error("No active subscription found to cancel");
    }

    const subscription = allSubs[0];
    logStep("Found subscription to cancel", { subscriptionId: subscription.id, status: subscription.status });

    let cancelled;
    if (at_period_end) {
      // Cancel at end of billing period
      cancelled = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
      logStep("Set cancel_at_period_end", { subscriptionId: cancelled.id });
    } else {
      // Immediate cancellation
      cancelled = await stripe.subscriptions.cancel(subscription.id);
      logStep("Immediately cancelled", { subscriptionId: cancelled.id });
    }

    // Update local subscription record
    const periodEnd = cancelled.current_period_end
      ? new Date(cancelled.current_period_end * 1000).toISOString()
      : null;

    await supabaseClient
      .from("subscriptions")
      .update({
        status: at_period_end ? "active" : "cancelled",
        cancel_at_period_end: at_period_end,
        current_period_end: periodEnd,
      })
      .eq("user_id", user.id)
      .in("status", ["active", "trial"]);

    logStep("Updated local subscription record");

    return new Response(
      JSON.stringify({
        success: true,
        cancel_at_period_end: at_period_end,
        current_period_end: periodEnd,
        subscription_id: cancelled.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
