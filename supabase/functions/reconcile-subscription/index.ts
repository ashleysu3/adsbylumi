// Reconciles a user's subscription state directly from Stripe. Called right
// after a successful checkout so the app doesn't have to wait for the async
// Stripe webhook to fire (or for the 60s SubscriptionContext refresh tick).
//
// Auth: requires a signed-in user (any user, incl. just-converted anonymous).
// It looks up their Stripe customer by email, finds an active/trialing
// subscription, and upserts a row into public.subscriptions so
// check-subscription (and any local-table gates) immediately see them as paid.

import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const PRICE_TO_TIER: Record<string, "starter" | "growth" | "agency_pro"> = {
  "price_1SqhzNACcLoSGSlnGp86B5RM": "starter",
  "price_1Smg0LACcLoSGSln5d9ORSwW": "starter",
  "price_1Sa2ZtACcLoSGSlnyuVLrBwM": "growth",
  "price_1Sa2ZuACcLoSGSlnlDZcf6eV": "growth",
};

function mapStatus(s: string): string {
  switch (s) {
    case "trialing": return "trial";
    case "active": return "active";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled":
    case "incomplete_expired": return "cancelled";
    default: return s;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user?.email) {
      return new Response(JSON.stringify({ reconciled: false, reason: "no_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Best-effort: keep profiles.email in sync so the webhook can find this
    // user by email on future events (anonymous→permanent leaves it null).
    await admin.from("profiles").update({ email: user.email }).eq("id", user.id);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Match by session_id first (most precise, tolerates email casing changes)
    let subscription: Stripe.Subscription | null = null;
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const sessionId: string | undefined = body?.session_id;

    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const subId = session.subscription as string | null;
        if (subId) subscription = await stripe.subscriptions.retrieve(subId);
      } catch (e) {
        console.error("[reconcile] session lookup failed", (e as Error).message);
      }
    }

    if (!subscription) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length === 0) {
        return new Response(JSON.stringify({ reconciled: false, reason: "no_customer" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const customerId = customers.data[0].id;
      const active = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      const trialing = await stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 });
      subscription = active.data[0] ?? trialing.data[0] ?? null;
    }

    if (!subscription) {
      return new Response(JSON.stringify({ reconciled: false, reason: "no_active_sub" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const item = subscription.items?.data?.[0];
    const priceId = item?.price?.id ?? null;
    const tier = (priceId && PRICE_TO_TIER[priceId]) || "starter";
    const status = mapStatus(subscription.status);
    const periodEnd = (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : null;
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null;

    const { error: upErr } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          tier,
          status,
          price_id: priceId,
          current_period_end: periodEnd,
          trial_end: trialEnd,
          cancel_at_period_end: !!subscription.cancel_at_period_end,
        },
        { onConflict: "user_id" },
      );
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ reconciled: true, tier, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[reconcile-subscription] ERROR", message);
    return new Response(JSON.stringify({ reconciled: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
