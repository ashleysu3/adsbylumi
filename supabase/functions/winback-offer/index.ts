// Public endpoint for win-back trial offers.
// Two actions:
//   action: "get"    -> returns offer details + card last4 for the reactivation page
//   action: "accept" -> records consent, creates the Stripe trial subscription
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });

const fail = (error: string, code = "error") =>
  new Response(JSON.stringify({ error, code }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, token } = body;
    if (!token || typeof token !== "string") return fail("Token required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    // Load offer
    const { data: offer, error: offerErr } = await supabase
      .from("winback_offers")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (offerErr) return fail(offerErr.message);
    if (!offer) return fail("Offer not found", "not_found");

    const now = Date.now();
    const expired = new Date(offer.expires_at).getTime() < now;

    if (action === "get") {
      // Attempt to retrieve card last4 from Stripe (best effort)
      let cardLast4: string | null = null;
      let cardBrand: string | null = null;
      try {
        const customers = await stripe.customers.list({ email: offer.email, limit: 1 });
        if (customers.data.length > 0) {
          const customer = customers.data[0];
          const pmId =
            (customer.invoice_settings?.default_payment_method as string) ||
            (typeof customer.default_source === "string" ? customer.default_source : null);
          if (pmId) {
            const pm = await stripe.paymentMethods.retrieve(pmId);
            if (pm.card) {
              cardLast4 = pm.card.last4;
              cardBrand = pm.card.brand;
            }
          } else {
            // fallback: list payment methods
            const pms = await stripe.paymentMethods.list({
              customer: customer.id,
              type: "card",
              limit: 1,
            });
            if (pms.data[0]?.card) {
              cardLast4 = pms.data[0].card.last4;
              cardBrand = pms.data[0].card.brand;
            }
          }
        }
      } catch (_) {
        // ignore
      }

      return ok({
        offer: {
          id: offer.id,
          email: offer.email,
          status: expired && offer.status === "pending" ? "expired" : offer.status,
          trial_days: offer.trial_days,
          offered_price_cents: offer.offered_price_cents,
          currency: offer.currency,
          interval: offer.interval,
          expires_at: offer.expires_at,
          accepted_at: offer.accepted_at,
        },
        card: cardLast4 ? { last4: cardLast4, brand: cardBrand } : null,
      });
    }

    if (action === "accept") {
      if (offer.status === "accepted") return fail("Offer already accepted", "already_accepted");
      if (offer.status === "revoked") return fail("Offer was revoked", "revoked");
      if (expired) {
        await supabase.from("winback_offers").update({ status: "expired" }).eq("id", offer.id);
        return fail("Offer has expired", "expired");
      }
      if (!body.consent) return fail("Consent confirmation required", "no_consent");

      // Find or create Stripe customer
      const customers = await stripe.customers.list({ email: offer.email, limit: 1 });
      if (customers.data.length === 0) {
        return fail("No Stripe customer found for this email", "no_customer");
      }
      const customer = customers.data[0];

      // Refuse if a live subscription already exists
      const existing = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 20,
      });
      const liveSub = existing.data.find((s: any) =>
        ["active", "trialing", "past_due", "unpaid"].includes(s.status),
      );
      if (liveSub) return fail("You already have an active subscription", "already_subscribed");

      // Resolve a usable price: prefer the one stored on the offer, else
      // fall back to the customer's most recent subscription price.
      let priceId = offer.price_id as string | null;
      if (!priceId) {
        const lastSub = existing.data.sort((a: any, b: any) => b.created - a.created)[0];
        priceId = lastSub?.items?.data?.[0]?.price?.id || null;
      }
      // If admin set a custom price amount but no price_id, create one now
      if (!priceId && offer.offered_price_cents) {
        // need a product — try to grab from most recent sub
        const lastSub = existing.data.sort((a: any, b: any) => b.created - a.created)[0];
        const productId = lastSub?.items?.data?.[0]?.price?.product;
        if (productId) {
          const newPrice = await stripe.prices.create({
            product: typeof productId === "string" ? productId : productId.id,
            unit_amount: offer.offered_price_cents,
            currency: offer.currency || "usd",
            recurring: { interval: (offer.interval || "month") as any },
            nickname: `Win-back ${offer.email}`,
          });
          priceId = newPrice.id;
        }
      }
      if (!priceId) {
        return fail(
          "Could not resolve a subscription price. Please contact support.",
          "no_price",
        );
      }

      // Check the customer has a usable default payment method
      const defaultPm =
        (customer.invoice_settings?.default_payment_method as string) || null;
      let hasPm = !!defaultPm;
      if (!hasPm) {
        const pms = await stripe.paymentMethods.list({
          customer: customer.id,
          type: "card",
          limit: 1,
        });
        hasPm = pms.data.length > 0;
        // promote first card to default so the trial can auto-charge
        if (hasPm) {
          await stripe.customers.update(customer.id, {
            invoice_settings: { default_payment_method: pms.data[0].id },
          });
        }
      }
      if (!hasPm) {
        return fail(
          "No payment method on file. Please contact support to add a card before reactivating.",
          "no_payment_method",
        );
      }

      // Create the trial subscription. Trial starts NOW (the moment of consent).
      const newSub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: offer.trial_days || 14,
        proration_behavior: "none",
        payment_settings: { save_default_payment_method: "on_subscription" },
      });

      // Sync local subscriptions table
      if (offer.user_id) {
        await supabase.from("subscriptions").upsert(
          {
            user_id: offer.user_id,
            stripe_subscription_id: newSub.id,
            stripe_customer_id: customer.id,
            status: newSub.status,
            price_id: priceId,
            trial_end: newSub.trial_end
              ? new Date(newSub.trial_end * 1000).toISOString()
              : null,
            current_period_end: newSub.current_period_end
              ? new Date(newSub.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: false,
          },
          { onConflict: "user_id" },
        );
      }

      // Mark offer accepted with consent record
      const consentIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        null;
      const consentUa = req.headers.get("user-agent") || null;

      await supabase
        .from("winback_offers")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          consent_ip: consentIp,
          consent_user_agent: consentUa,
          stripe_subscription_id: newSub.id,
          stripe_customer_id: customer.id,
          price_id: priceId,
        })
        .eq("id", offer.id);

      const trialEnd = newSub.trial_end ? new Date(newSub.trial_end * 1000).toISOString() : null;
      return ok({
        success: true,
        subscription_id: newSub.id,
        trial_end: trialEnd,
        redirect_to: "/welcome-back",
      });
    }

    if (action === "set_start_choice") {
      const choice = body.choice;
      if (!["fresh", "resume"].includes(choice)) return fail("Invalid choice");
      await supabase
        .from("winback_offers")
        .update({ start_choice: choice })
        .eq("id", offer.id);
      return ok({ success: true });
    }

    return fail("Unknown action");
  } catch (e: any) {
    console.error("[winback-offer]", e);
    return fail(e?.message || "Unexpected error");
  }
});
