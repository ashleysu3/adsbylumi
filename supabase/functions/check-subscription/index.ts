import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      logStep("Auth failed (likely expired token), returning unsubscribed", { error: userError?.message });
      return new Response(JSON.stringify({
        subscribed: false,
        product_id: null,
        price_id: null,
        tier: null,
        status: null,
        subscription_end: null,
        cancel_at_period_end: false,
        is_code_based: false,
        is_trial: false,
        discount: null,
        amount_paid: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // First, check the local subscriptions table
    const { data: localSub, error: localSubError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (localSub && !localSubError) {
      logStep("Found local subscription", { 
        tier: localSub.tier, 
        status: localSub.status,
        hasStripeId: !!localSub.stripe_subscription_id 
      });

      // Check if subscription is cancelled - but allow access if still within paid/trial period
      if (localSub.status === 'cancelled' || localSub.status === 'canceled') {
        const now = new Date();
        const periodEnd = localSub.current_period_end ? new Date(localSub.current_period_end) : null;
        const trialEnd = localSub.trial_end ? new Date(localSub.trial_end) : null;
        const effectiveEnd = trialEnd && trialEnd > (periodEnd || new Date(0)) ? trialEnd : periodEnd;

        if (effectiveEnd && effectiveEnd > now) {
          logStep("Subscription cancelled but still within access period", {
            effectiveEnd: effectiveEnd.toISOString(),
          });
          return new Response(JSON.stringify({
            subscribed: true,
            product_id: null,
            price_id: null,
            tier: localSub.tier,
            status: 'cancelled',
            subscription_end: effectiveEnd.toISOString(),
            cancel_at_period_end: false,
            is_code_based: !localSub.stripe_subscription_id,
            is_trial: !!trialEnd && trialEnd > now,
            discount: null,
            amount_paid: null,
            billing_interval: null,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        logStep("Subscription is cancelled and access period has ended");
        return new Response(JSON.stringify({
          subscribed: false,
          product_id: null,
          price_id: null,
          tier: null,
          status: 'cancelled',
          subscription_end: localSub.current_period_end,
          cancel_at_period_end: false,
          is_code_based: false,
          is_trial: false,
          discount: null,
          amount_paid: null,
          billing_interval: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Always check Stripe for paid subscriptions (even if code-based exists)
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (stripeKey) {
      logStep("Stripe key verified, checking Stripe");

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Resolve the Stripe customer from the stored IDs FIRST. Email lookup is a
      // last resort: the Stripe customer email often drifts from the login email
      // (alt email, typo, casing), which used to strand paying users in preview mode.
      let customerId: string | null = localSub?.stripe_customer_id || null;

      if (!customerId && localSub?.stripe_subscription_id) {
        try {
          const storedSub = await stripe.subscriptions.retrieve(localSub.stripe_subscription_id);
          customerId = typeof storedSub.customer === "string"
            ? storedSub.customer
            : (storedSub.customer as any)?.id || null;
          logStep("Resolved customer from stored subscription id", { customerId });
        } catch (subErr) {
          logStep("Stored subscription id lookup failed", { error: String(subErr) });
        }
      }

      if (!customerId) {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        customerId = customers.data[0]?.id || null;
      }

      if (customerId) {
        logStep("Found Stripe customer", { customerId });



        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 1,
          expand: ['data.discount', 'data.discount.coupon'],
        });
        
        // Also check for trialing subscriptions in Stripe
        const trialSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "trialing",
          limit: 1,
          expand: ['data.discount', 'data.discount.coupon'],
        });

        const allSubs = [...subscriptions.data, ...trialSubscriptions.data];

        if (allSubs.length > 0) {
          const subscription = allSubs[0];
          const subscriptionEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;
          const cancelAtPeriodEnd = subscription.cancel_at_period_end;
          const isTrial = subscription.status === 'trialing';
          const productId = subscription.items.data[0].price.product;
          const priceId = subscription.items.data[0].price.id;

          // Extract discount/coupon info
          let discount: any = null;
          if (subscription.discount?.coupon) {
            const coupon = subscription.discount.coupon;
            discount = {
              coupon_name: coupon.name || coupon.id,
              percent_off: coupon.percent_off || null,
              amount_off: coupon.amount_off ? coupon.amount_off / 100 : null, // Convert cents to dollars
              duration: coupon.duration,
              duration_in_months: coupon.duration_in_months || null,
            };
          }

          // Get actual amount being charged
          const priceObj = subscription.items.data[0].price;
          const unitAmount = priceObj.unit_amount ? priceObj.unit_amount / 100 : null; // cents → dollars
          const interval = priceObj.recurring?.interval || 'month';

          // Card on file — so the UI can show "Visa ending 4242" without a
          // round-trip to the billing portal.
          let paymentMethod: any = null;
          try {
            const pms = await stripe.paymentMethods.list({
              customer: customerId,
              type: "card",
              limit: 1,
            });
            const card = pms.data[0]?.card;
            if (card) {
              paymentMethod = {
                brand: card.brand,
                last4: card.last4,
                exp_month: card.exp_month,
                exp_year: card.exp_year,
              };
            }
          } catch (pmErr) {
            logStep("Could not load payment method", { error: String(pmErr) });
          }

          logStep("Active Stripe subscription found", { 
            subscriptionId: subscription.id, 
            productId, priceId, discount, unitAmount, interval
          });

          return new Response(JSON.stringify({
            subscribed: true,
            product_id: productId,
            price_id: priceId,
            tier: null,
            status: subscription.status,
            subscription_end: subscriptionEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            is_trial: isTrial,
            is_code_based: false,
            discount,
            amount_paid: unitAmount,
            billing_interval: interval,
            payment_method: paymentMethod,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // No active Stripe subscription surfaced from the email lookup above. Fall
    // back to the local `subscriptions` row, which the webhook/reconcile write
    // and treat as the source of truth. Two cases we honor here:
    //   1) Code-based comp (no stripe_subscription_id): honor active/trial as before.
    //   2) A real PAID row (has stripe_subscription_id) whose live lookup came
    //      back empty because the Stripe customer email drifted from the login
    //      email (a typo/casing/alt-email mismatch). Previously this returned
    //      preview mode even though the user had paid — the exact "paid but stuck
    //      in preview" failure. We now honor it, but ONLY while its paid/trial
    //      window is still valid, so a genuinely-lapsed row can't grant access
    //      indefinitely.
    if (localSub && !localSubError &&
        (localSub.status === 'active' || localSub.status === 'trial')) {
      const isCodeBased = !localSub.stripe_subscription_id;
      const now = new Date();
      const periodEnd = localSub.current_period_end ? new Date(localSub.current_period_end) : null;
      const trialEnd = localSub.trial_end ? new Date(localSub.trial_end) : null;
      const stillValid = (periodEnd && periodEnd > now) || (trialEnd && trialEnd > now);

      // Comps have no billing period to check; paid rows must still be in-window.
      if (isCodeBased || stillValid) {
        logStep("No live Stripe sub, honoring local subscription row", {
          tier: localSub.tier, status: localSub.status, isCodeBased, stillValid,
        });
        return new Response(JSON.stringify({
          subscribed: true,
          product_id: null,
          price_id: null,
          tier: localSub.tier,
          status: localSub.status,
          subscription_end: localSub.current_period_end,
          cancel_at_period_end: localSub.cancel_at_period_end || false,
          is_code_based: isCodeBased,
          is_trial: localSub.status === 'trial',
          discount: null,
          amount_paid: null,
          billing_interval: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    logStep("No subscription found at all");
    return new Response(JSON.stringify({ 
      subscribed: false,
      product_id: null,
      price_id: null,
      tier: null,
      status: null,
      subscription_end: null,
      cancel_at_period_end: false,
      is_code_based: false,
      is_trial: false,
      discount: null,
      amount_paid: null,
      billing_interval: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
