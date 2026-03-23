import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GUEST-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { priceId, promoCode, rewardful_referral } = await req.json();
    if (!priceId) throw new Error("Price ID is required");
    logStep("Price ID received", { priceId, promoCode: promoCode || "none", rewardful_referral: rewardful_referral || "none" });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Auto-apply LUMIBETA founding member discount before March 30, 2026
    const foundingMemberCutoff = new Date('2026-03-30T23:59:59Z');
    const isFoundingPeriod = new Date() < foundingMemberCutoff;
    const lumiBetaCouponId = 'zBPhY3uh';

    logStep("Founding member check", { isFoundingPeriod, cutoff: foundingMemberCutoff.toISOString() });

    const returnOrigin = origin || "https://youradassistant.lovable.app";
    const sessionOptions: any = {
      client_reference_id: rewardful_referral || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${returnOrigin}/auth?signup=true&paid=true`,
      cancel_url: `${returnOrigin}/`,
      ...(isFoundingPeriod
        ? { discounts: [{ coupon: lumiBetaCouponId }] }
        : { allow_promotion_codes: true }),
    };

    const session = await stripe.checkout.sessions.create(sessionOptions);

    logStep("Guest checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
