import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getPublicAppUrl } from "../_shared/site-url.ts";
import { resolveDiscountCouponId } from "../_shared/pricing-config.ts";

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

    const { priceId, promoCode, rewardful_referral, partnerCode, returnTo } = await req.json();
    if (!priceId) throw new Error("Price ID is required");
    logStep("Price ID received", { priceId, promoCode: promoCode || "none", rewardful_referral: rewardful_referral || "none", partnerCode: partnerCode || "none", returnTo: returnTo || "none" });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check for partner trial code
    let isPartnerTrial = false;
    let partnerEmail = '';
    let partnerTrialDays = 0;
    let partnerReferralId = '';
    if (partnerCode) {
      const { data: tokenData } = await supabaseAdmin
        .from("partner_access_tokens")
        .select("email, rewardful_affiliate_id, trial_days, referral_link, is_active")
        .eq("partner_trial_code", partnerCode.toUpperCase().trim())
        .maybeSingle();

      if (tokenData && (tokenData as any).is_active !== false) {
        isPartnerTrial = true;
        partnerEmail = tokenData.email;
        partnerTrialDays = (tokenData as any).trial_days || 14;
        const refLink = (tokenData as any).referral_link as string | null;
        if (refLink) {
          try {
            const u = new URL(refLink);
            partnerReferralId = u.searchParams.get("via") || "";
          } catch { /* ignore */ }
        }
        if (!partnerReferralId && tokenData.rewardful_affiliate_id) {
          partnerReferralId = tokenData.rewardful_affiliate_id;
        }
        logStep("Partner trial code valid", { partnerEmail, code: partnerCode, partnerTrialDays, partnerReferralId });
      } else {
        logStep("Partner trial code not found or inactive", { code: partnerCode });
      }
    }

    // Trust the request origin only if it's our production app; otherwise
    // fall back to the canonical app URL so checkout never returns to a
    // preview/staging origin.
    const trustedOrigin = origin && /^https:\/\/(www\.)?adsbylumi\.com$/.test(origin) ? origin : null;
    const returnOrigin = trustedOrigin || getPublicAppUrl();

    const sessionOptions: any = {
      client_reference_id: partnerReferralId || rewardful_referral || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      // Only accept safe same-origin app paths for returnTo.
      success_url: (() => {
        const safeReturn = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "";
        const rt = safeReturn ? `&returnTo=${encodeURIComponent(safeReturn)}` : "";
        return `${returnOrigin}/auth?signup=true&paid=true&session_id={CHECKOUT_SESSION_ID}${rt}`;
      })(),
      cancel_url: `${returnOrigin}/`,
    };

    if (isPartnerTrial) {
      // Partners may have real negotiated trial terms — unaffected by the
      // default discount-instead-of-trial change below.
      sessionOptions.allow_promotion_codes = true;
      sessionOptions.subscription_data = {
        trial_period_days: partnerTrialDays,
        metadata: {
          partner_code: partnerCode.toUpperCase().trim(),
          partner_email: partnerEmail,
          partner_referral_id: partnerReferralId || '',
        },
      };
    } else {
      // First-month discount replaces the old trial for everyone else —
      // Stripe doesn't allow `discounts` and `allow_promotion_codes` together.
      const { couponId, discountPercent } = await resolveDiscountCouponId(supabaseAdmin, stripe);
      logStep("Resolved discount coupon", { couponId, discountPercent });
      sessionOptions.discounts = [{ coupon: couponId }];
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
