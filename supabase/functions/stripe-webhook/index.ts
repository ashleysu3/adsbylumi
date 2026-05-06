import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Stripe price IDs → internal tier enum (subscription_tier: starter | growth | agency_pro)
// Keep in sync with src/lib/subscription-tiers.ts
const PRICE_TO_TIER: Record<string, "starter" | "growth" | "agency_pro"> = {
  // Solo → starter
  "price_1SqhzNACcLoSGSlnGp86B5RM": "starter",
  "price_1Smg0LACcLoSGSln5d9ORSwW": "starter",
  // Creator → growth
  "price_1Sa2ZtACcLoSGSlnyuVLrBwM": "growth",
  "price_1Sa2ZuACcLoSGSlnlDZcf6eV": "growth",
};

function tierFromPriceId(priceId: string | null | undefined): "starter" | "growth" | "agency_pro" {
  if (priceId && PRICE_TO_TIER[priceId]) return PRICE_TO_TIER[priceId];
  return "starter";
}

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

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabaseAdmin, stripe, session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscription(supabaseAdmin, stripe, subscription);

        // Existing logic: handle cancel-at-period-end transitions
        if (event.type === "customer.subscription.updated") {
          const previousAttributes = (event.data as any).previous_attributes;
          if (
            subscription.cancel_at_period_end &&
            previousAttributes?.cancel_at_period_end === false
          ) {
            logStep("Subscription set to cancel at period end", { subscriptionId: subscription.id });
            await handleSubscriptionCancelAtPeriodEnd(supabaseAdmin, stripe, subscription);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(supabaseAdmin, stripe, subscription);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string | null;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(supabaseAdmin, stripe, subscription);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string | null;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(supabaseAdmin, stripe, subscription, "past_due");
        }
        break;
      }
      default:
        logStep("Unhandled event type", { type: event.type });
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

async function handleCheckoutCompleted(
  supabaseAdmin: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") {
    logStep("checkout.session.completed ignored (not subscription)", { mode: session.mode });
    return;
  }
  const subId = session.subscription as string | null;
  if (!subId) {
    logStep("No subscription on session, skipping");
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(subId);
  await upsertSubscription(supabaseAdmin, stripe, subscription);
}

/**
 * Upsert local entitlement row from a Stripe subscription. This is the source
 * of truth for paid/plan access — gates check `subscriptions.status` and `tier`.
 */
async function upsertSubscription(
  supabaseAdmin: any,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  forcedStatus?: string
) {
  const customerEmail = await getCustomerEmail(stripe, subscription.customer as string);
  if (!customerEmail) {
    logStep("upsertSubscription: no customer email, skipping", { subId: subscription.id });
    return;
  }

  const userId = await getUserIdByEmail(supabaseAdmin, customerEmail);
  if (!userId) {
    logStep("upsertSubscription: no user found for email", { email: customerEmail });
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const tier = tierFromPriceId(priceId);
  const status = forcedStatus ?? mapStripeStatus(subscription.status);
  const periodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000).toISOString()
    : null;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        tier,
        status,
        price_id: priceId,
        current_period_end: periodEnd,
        trial_end: trialEnd,
        cancel_at_period_end: !!subscription.cancel_at_period_end,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    logStep("upsertSubscription FAILED", { error: error.message, userId, subId: subscription.id });
    throw error;
  }

  logStep("Subscription upserted", { userId, tier, status, priceId });
}

function mapStripeStatus(stripeStatus: string): string {
  // subscriptions.status is plain text; normalize to our app's known values
  switch (stripeStatus) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    case "incomplete":
      return "incomplete";
    case "paused":
      return "paused";
    default:
      return stripeStatus;
  }
}

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

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled", cancel_at_period_end: false })
    .eq("user_id", userId);

  logStep("Local subscription updated to cancelled", { userId });

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

  await triggerHandleCancellation({
    userId,
    userEmail: customerEmail,
    fullName: profile?.full_name || "",
    tierName: sub?.tier || "",
    periodEnd: (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
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

  await supabaseAdmin
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    })
    .eq("user_id", userId);

  logStep("Local subscription updated with cancel_at_period_end", { userId });

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

  await triggerHandleCancellation({
    userId,
    userEmail: customerEmail,
    fullName: profile?.full_name || "",
    tierName: sub?.tier || "",
    periodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
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
    .maybeSingle();
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
