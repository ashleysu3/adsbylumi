import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
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

    const { priceId, promoCode, rewardful_referral, partnerCode } = await req.json();
    if (!priceId) throw new Error("Price ID is required");
    logStep("Price ID received", { priceId, promoCode: promoCode || "none", rewardful_referral: rewardful_referral || "none", partnerCode: partnerCode || "none" });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for partner trial code
    let isPartnerTrial = false;
    let partnerEmail = '';
    if (partnerCode) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: tokenData } = await supabase
        .from("partner_access_tokens")
        .select("email, rewardful_affiliate_id")
        .eq("partner_trial_code", partnerCode.toUpperCase().trim())
        .maybeSingle();

      if (tokenData) {
        isPartnerTrial = true;
        partnerEmail = tokenData.email;
        logStep("Partner trial code valid", { partnerEmail, code: partnerCode });
      } else {
        logStep("Partner trial code not found", { code: partnerCode });
      }
    }

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
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
      },
    };

    if (isPartnerTrial) {
      // Partner trial: 14-day free trial overrides the default 7-day
      sessionOptions.subscription_data = {
        trial_period_days: 14,
        metadata: {
          partner_code: partnerCode.toUpperCase().trim(),
          partner_email: partnerEmail,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    logStep("Guest checkout session created", { sessionId: session.id, url: session.url, isPartnerTrial });

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
