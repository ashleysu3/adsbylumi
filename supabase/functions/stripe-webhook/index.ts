import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Verify webhook signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle subscription cancellation events
    if (event.type === "customer.subscription.deleted") {
      // Subscription was fully cancelled/expired
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCancelled(supabaseAdmin, stripe, subscription);
    } else if (event.type === "customer.subscription.updated") {
      // Check if cancel_at_period_end was just set to true
      const subscription = event.data.object as Stripe.Subscription;
      const previousAttributes = (event.data as any).previous_attributes;

      if (subscription.cancel_at_period_end && previousAttributes?.cancel_at_period_end === false) {
        logStep("Subscription set to cancel at period end", { subscriptionId: subscription.id });
        await handleSubscriptionCancelAtPeriodEnd(supabaseAdmin, stripe, subscription);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleSubscriptionCancelled(
  supabaseAdmin: any,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  logStep("Processing subscription.deleted", { subscriptionId: subscription.id });

  const customerEmail = await getCustomerEmail(stripe, subscription.customer as string);
  if (!customerEmail) {
    logStep("Could not resolve customer email, skipping");
    return;
  }

  const userId = await getUserIdByEmail(supabaseAdmin, customerEmail);
  if (!userId) {
    logStep("No user found for email, skipping", { email: customerEmail });
    return;
  }

  // Update local subscription status
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled", cancel_at_period_end: false })
    .eq("user_id", userId);

  logStep("Local subscription updated to cancelled", { userId });

  // Get user details for cancellation handling
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .single();

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("tier, current_period_end")
    .eq("user_id", userId)
    .single();

  // Call handle-cancellation to pause ads and send email
  await triggerHandleCancellation({
    userId,
    userEmail: customerEmail,
    fullName: profile?.full_name || "",
    tierName: sub?.tier || "",
    periodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : sub?.current_period_end || null,
  });
}

async function handleSubscriptionCancelAtPeriodEnd(
  supabaseAdmin: any,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  logStep("Processing cancel_at_period_end", { subscriptionId: subscription.id });

  const customerEmail = await getCustomerEmail(stripe, subscription.customer as string);
  if (!customerEmail) {
    logStep("Could not resolve customer email, skipping");
    return;
  }

  const userId = await getUserIdByEmail(supabaseAdmin, customerEmail);
  if (!userId) {
    logStep("No user found for email, skipping", { email: customerEmail });
    return;
  }

  // Update local subscription to reflect pending cancellation
  await supabaseAdmin
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq("user_id", userId);

  logStep("Local subscription updated with cancel_at_period_end", { userId });

  // Get user details
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .single();

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userId)
    .single();

  // Pause ads and send cancellation email immediately
  await triggerHandleCancellation({
    userId,
    userEmail: customerEmail,
    fullName: profile?.full_name || "",
    tierName: sub?.tier || "",
    periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  });
}

async function getCustomerEmail(stripe: Stripe, customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ((customer as any).deleted) return null;
    return (customer as Stripe.Customer).email || null;
  } catch {
    return null;
  }
}

async function getUserIdByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  return data?.id || null;
}

async function triggerHandleCancellation(payload: {
  userId: string;
  userEmail: string;
  fullName: string;
  tierName: string;
  periodEnd: string | null;
}) {
  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-cancellation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    logStep("handle-cancellation result", data);
  } catch (err) {
    logStep("Error calling handle-cancellation", { error: err });
  }
}
