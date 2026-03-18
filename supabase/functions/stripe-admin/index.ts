import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-ADMIN] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin secret
    const adminSecret = Deno.env.get("STRIPE_ADMIN_SECRET");
    if (!adminSecret) throw new Error("STRIPE_ADMIN_SECRET not configured");

    const providedSecret = req.headers.get("x-admin-secret");
    if (providedSecret !== adminSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const { action, email, params } = await req.json();
    logStep("Action received", { action, email });

    if (!action) throw new Error("action is required");

    // Helper: find customer by email
    const findCustomer = async (customerEmail: string) => {
      if (!customerEmail) throw new Error("email is required");
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length === 0) throw new Error(`No Stripe customer found for ${customerEmail}`);
      return customers.data[0];
    };

    // Helper: get active subscription
    const getActiveSubscription = async (customerId: string) => {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      if (subs.data.length === 0) throw new Error("No active subscription found");
      return subs.data[0];
    };

    let result: any;

    switch (action) {
      case "get_customer": {
        const customer = await findCustomer(email);
        const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 5 });
        const invoices = await stripe.invoices.list({ customer: customer.id, limit: 5 });
        result = {
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            created: customer.created,
          },
          subscriptions: subs.data.map((s) => ({
            id: s.id,
            status: s.status,
            current_period_end: new Date(s.current_period_end * 1000).toISOString(),
            plan: s.items.data[0]?.price?.id,
            product: s.items.data[0]?.price?.product,
          })),
          recent_invoices: invoices.data.map((i) => ({
            id: i.id,
            status: i.status,
            amount_due: i.amount_due,
            currency: i.currency,
            created: new Date(i.created * 1000).toISOString(),
            hosted_invoice_url: i.hosted_invoice_url,
          })),
        };
        break;
      }

      case "apply_coupon": {
        const customer = await findCustomer(email);
        const sub = await getActiveSubscription(customer.id);
        const couponId = params?.coupon_id;
        if (!couponId) throw new Error("params.coupon_id is required");
        const updated = await stripe.subscriptions.update(sub.id, { coupon: couponId });
        result = { success: true, subscription_id: updated.id, discount: updated.discount };
        break;
      }

      case "update_subscription_price": {
        const customer = await findCustomer(email);
        const sub = await getActiveSubscription(customer.id);
        const newPriceId = params?.price_id;
        if (!newPriceId) throw new Error("params.price_id is required");
        const updated = await stripe.subscriptions.update(sub.id, {
          items: [{ id: sub.items.data[0].id, price: newPriceId }],
          proration_behavior: params?.proration_behavior || "create_prorations",
        });
        result = { success: true, subscription_id: updated.id, new_price: newPriceId };
        break;
      }

      case "resend_receipt": {
        const customer = await findCustomer(email);
        const invoiceId = params?.invoice_id;
        let invoice;
        if (invoiceId) {
          invoice = await stripe.invoices.retrieve(invoiceId);
        } else {
          const invoices = await stripe.invoices.list({ customer: customer.id, status: "paid", limit: 1 });
          if (invoices.data.length === 0) throw new Error("No paid invoices found");
          invoice = invoices.data[0];
        }
        await stripe.invoices.sendInvoice(invoice.id);
        result = { success: true, invoice_id: invoice.id };
        break;
      }

      case "cancel_subscription": {
        const customer = await findCustomer(email);
        const sub = await getActiveSubscription(customer.id);
        const cancelAtPeriodEnd = params?.at_period_end !== false;
        let canceled;
        if (cancelAtPeriodEnd) {
          canceled = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
        } else {
          canceled = await stripe.subscriptions.cancel(sub.id);
        }
        result = {
          success: true,
          subscription_id: canceled.id,
          status: canceled.status,
          cancel_at_period_end: canceled.cancel_at_period_end,
        };
        break;
      }

      case "refund": {
        const customer = await findCustomer(email);
        const chargeId = params?.charge_id;
        const paymentIntentId = params?.payment_intent_id;
        const amount = params?.amount; // in cents, optional for partial refund

        const refundParams: any = {};
        if (chargeId) {
          refundParams.charge = chargeId;
        } else if (paymentIntentId) {
          refundParams.payment_intent = paymentIntentId;
        } else {
          // Find the latest paid invoice charge
          const invoices = await stripe.invoices.list({ customer: customer.id, status: "paid", limit: 1 });
          if (invoices.data.length === 0) throw new Error("No paid invoices found to refund");
          refundParams.payment_intent = invoices.data[0].payment_intent;
        }
        if (amount) refundParams.amount = amount;
        if (params?.reason) refundParams.reason = params.reason;

        const refund = await stripe.refunds.create(refundParams);
        result = { success: true, refund_id: refund.id, status: refund.status, amount: refund.amount };
        break;
      }

      case "get_dispute_evidence": {
        const customer = await findCustomer(email);
        // Get ALL subscriptions (including canceled)
        const allSubs = await stripe.subscriptions.list({ customer: customer.id, limit: 100, status: "all" });
        // Get ALL charges
        const allCharges = await stripe.charges.list({ customer: customer.id, limit: 100 });
        // Get ALL invoices
        const allInvoices = await stripe.invoices.list({ customer: customer.id, limit: 100 });
        // Get disputes
        const disputes = await stripe.disputes.list({ limit: 100 });
        const customerDisputes = disputes.data.filter(
          (d: any) => allCharges.data.some((c: any) => c.id === d.charge)
        );

        result = {
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            created: new Date(customer.created * 1000).toISOString(),
          },
          subscriptions: allSubs.data.map((s: any) => ({
            id: s.id,
            status: s.status,
            created: new Date(s.created * 1000).toISOString(),
            current_period_start: new Date(s.current_period_start * 1000).toISOString(),
            current_period_end: new Date(s.current_period_end * 1000).toISOString(),
            cancel_at_period_end: s.cancel_at_period_end,
            canceled_at: s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : null,
            ended_at: s.ended_at ? new Date(s.ended_at * 1000).toISOString() : null,
            plan: s.items.data[0]?.price?.id,
            product: s.items.data[0]?.price?.product,
            amount: s.items.data[0]?.price?.unit_amount,
            interval: s.items.data[0]?.price?.recurring?.interval,
          })),
          charges: allCharges.data.map((c: any) => ({
            id: c.id,
            amount: c.amount,
            currency: c.currency,
            status: c.status,
            created: new Date(c.created * 1000).toISOString(),
            description: c.description,
            refunded: c.refunded,
            amount_refunded: c.amount_refunded,
            disputed: c.disputed,
          })),
          invoices: allInvoices.data.map((i: any) => ({
            id: i.id,
            status: i.status,
            amount_due: i.amount_due,
            amount_paid: i.amount_paid,
            currency: i.currency,
            created: new Date(i.created * 1000).toISOString(),
            hosted_invoice_url: i.hosted_invoice_url,
          })),
          disputes: customerDisputes.map((d: any) => ({
            id: d.id,
            amount: d.amount,
            currency: d.currency,
            status: d.status,
            reason: d.reason,
            created: new Date(d.created * 1000).toISOString(),
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    logStep("Action completed", { action });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === "Unauthorized" ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
