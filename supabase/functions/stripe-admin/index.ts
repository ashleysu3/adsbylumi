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
    // Auth: accept either admin secret header OR JWT from an admin user
    const adminSecret = Deno.env.get("STRIPE_ADMIN_SECRET");
    const providedSecret = req.headers.get("x-admin-secret");
    let authorized = false;

    if (adminSecret && providedSecret === adminSecret) {
      authorized = true;
      logStep("Authorized via admin secret");
    } else {
      // Try JWT-based admin auth
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const { createClient } = await import("npm:@supabase/supabase-js@2");
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        );
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabaseClient.auth.getUser(token);
        if (userData?.user) {
          const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } },
          );
          const { data: roleData } = await serviceClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (roleData) {
            authorized = true;
            logStep("Authorized via JWT admin role", { userId: userData.user.id });
          }
        }
      }
    }

    if (!authorized) {
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

      case "revenue_overview": {
        logStep("Fetching revenue overview");

        // Get all active subscriptions
        const allSubs: any[] = [];
        let hasMore = true;
        let startingAfter: string | undefined;
        while (hasMore) {
          const listParams: any = {
            status: "active",
            limit: 100,
            expand: ["data.customer", "data.discount", "data.discount.coupon"],
          };
          if (startingAfter) listParams.starting_after = startingAfter;
          const page = await stripe.subscriptions.list(listParams);
          allSubs.push(...page.data);
          hasMore = page.has_more;
          if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id;
        }

        const normalizeToMonthly = (cycleAmountCents: number, recurring: any) => {
          if (!recurring?.interval) return cycleAmountCents;
          const intervalCount = recurring.interval_count || 1;

          switch (recurring.interval) {
            case "year":
              return Math.round(cycleAmountCents / (12 * intervalCount));
            case "month":
              return Math.round(cycleAmountCents / intervalCount);
            case "week":
              return Math.round((cycleAmountCents * 52) / (12 * intervalCount));
            case "day":
              return Math.round((cycleAmountCents * 30) / intervalCount);
            default:
              return cycleAmountCents;
          }
        };

        const getLatestPaidInvoice = async (subscriptionId: string) => {
          const paidInvoices = await stripe.invoices.list({
            subscription: subscriptionId,
            status: "paid",
            limit: 1,
            expand: ["data.lines.data.price"],
          });
          return paidInvoices.data[0] ?? null;
        };

        const customerCache = new Map<string, { id: string; email: string | null; name: string | null }>();

        const getCustomerInfo = async (customerRef: any) => {
          if (!customerRef) return { id: "unknown", email: null, name: null };

          if (typeof customerRef === "object") {
            const expandedCustomer = {
              id: customerRef.id,
              email: customerRef.email ?? null,
              name: customerRef.name ?? null,
            };
            customerCache.set(expandedCustomer.id, expandedCustomer);
            return expandedCustomer;
          }

          if (customerCache.has(customerRef)) {
            return customerCache.get(customerRef)!;
          }

          try {
            const customer = await stripe.customers.retrieve(customerRef);
            const resolvedCustomer = {
              id: typeof customer === "string" ? customerRef : customer.id,
              email: typeof customer === "string" ? null : customer.email ?? null,
              name: typeof customer === "string" ? null : customer.name ?? null,
            };
            customerCache.set(customerRef, resolvedCustomer);
            return resolvedCustomer;
          } catch {
            const fallback = { id: customerRef, email: null, name: null };
            customerCache.set(customerRef, fallback);
            return fallback;
          }
        };

        let totalMRR = 0;
        let totalPayingSubscribers = 0;
        const priceBreakdown: Record<string, {
          count: number;
          amount: number;
          productName: string;
          interval: string;
          discountLabel: string | null;
          subscribers: Array<{
            email: string | null;
            customer_id: string;
            subscription_id: string;
            monthly_amount_cents: number;
            discount_label: string | null;
            app_user_id?: string | null;
            user_full_name?: string | null;
          }>;
        }> = {};

        for (const sub of allSubs) {
          const customer = await getCustomerInfo(sub.customer);
          const latestPaidInvoice = await getLatestPaidInvoice(sub.id);

          if (!latestPaidInvoice) {
            logStep("Skipping subscription without paid invoice", { subscriptionId: sub.id });
            continue;
          }

          const invoiceLines = (latestPaidInvoice.lines?.data || []).filter((line: any) => line.type === "subscription");
          const paidCycleTotal = invoiceLines.reduce((sum: number, line: any) => sum + (line.amount || 0), 0);

          const items = sub.items?.data || [];
          let subscriptionMonthlyTotal = 0;
          const cycleBaseAmounts = items.map((item: any) => {
            const unitAmount = item.price?.unit_amount || 0;
            const quantity = item.quantity || 1;
            return unitAmount * quantity;
          });
          const totalCycleBase = cycleBaseAmounts.reduce((sum: number, amount: number) => sum + amount, 0);

          for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const price = item.price;
            const cycleBaseAmount = cycleBaseAmounts[index] || 0;

            const matchingLine = invoiceLines.find((line: any) => {
              const linePriceId = typeof line.price === "string" ? line.price : line.price?.id;
              return linePriceId === price.id;
            });

            let netCycleAmount = matchingLine?.amount ?? 0;
            if (!netCycleAmount && totalCycleBase > 0) {
              const baseForAllocation = paidCycleTotal > 0
                ? paidCycleTotal
                : (latestPaidInvoice.amount_paid || latestPaidInvoice.amount_due || 0);
              netCycleAmount = Math.round((cycleBaseAmount / totalCycleBase) * baseForAllocation);
            }

            const monthlyAmount = normalizeToMonthly(netCycleAmount, price.recurring);
            totalMRR += monthlyAmount;
            subscriptionMonthlyTotal += monthlyAmount;

            const discountAmount = Math.max(0, cycleBaseAmount - netCycleAmount);
            const label = discountAmount > 0 ? `$${(discountAmount / 100).toFixed(2)} off` : null;

            const productName = typeof price.product === "string"
              ? price.product
              : (price.product as any)?.name || "Unknown";

            const groupKey = `${price.id}_${monthlyAmount}_${label || "standard"}`;
            if (!priceBreakdown[groupKey]) {
              priceBreakdown[groupKey] = {
                count: 0,
                amount: monthlyAmount,
                productName,
                interval: price.recurring?.interval || "month",
                discountLabel: label,
                subscribers: [],
              };
            }
            priceBreakdown[groupKey].count += 1;
            priceBreakdown[groupKey].subscribers.push({
              email: customer.email,
              customer_id: customer.id,
              subscription_id: sub.id,
              monthly_amount_cents: monthlyAmount,
              discount_label: label,
            });

            logStep("Revenue line item", {
              subscriptionId: sub.id,
              priceId: price.id,
              cycleBaseAmount,
              netCycleAmount,
              monthlyAmount,
              invoiceId: latestPaidInvoice.id,
            });
          }

          if (subscriptionMonthlyTotal > 0) {
            totalPayingSubscribers += 1;
          }
        }

        // Map Stripe customer emails back to app users for "view account" links
        const emails = [...new Set(
          Object.values(priceBreakdown)
            .flatMap((entry) => entry.subscribers.map((s) => s.email))
            .filter(Boolean) as string[]
        )];

        const profileByEmail: Record<string, { id: string; full_name: string | null }> = {};
        if (emails.length > 0) {
          const { createClient } = await import("npm:@supabase/supabase-js@2");
          const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } },
          );

          for (let i = 0; i < emails.length; i += 100) {
            const emailBatch = emails.slice(i, i + 100);
            const { data: profiles } = await serviceClient
              .from("profiles")
              .select("id, email, full_name")
              .in("email", emailBatch);

            for (const profile of profiles || []) {
              if (profile.email) {
                profileByEmail[profile.email.toLowerCase()] = {
                  id: profile.id,
                  full_name: profile.full_name,
                };
              }
            }
          }
        }

        for (const entry of Object.values(priceBreakdown)) {
          entry.subscribers = entry.subscribers.map((subscriber) => {
            const profile = subscriber.email
              ? profileByEmail[subscriber.email.toLowerCase()]
              : undefined;

            return {
              ...subscriber,
              app_user_id: profile?.id ?? null,
              user_full_name: profile?.full_name ?? null,
            };
          });
        }

        // Resolve product names
        const productIds = [...new Set(Object.values(priceBreakdown).map(p => p.productName).filter(n => n.startsWith("prod_")))];
        const productNames: Record<string, string> = {};
        for (const pid of productIds) {
          try {
            const prod = await stripe.products.retrieve(pid);
            productNames[pid] = prod.name;
          } catch { productNames[pid] = pid; }
        }
        for (const key of Object.keys(priceBreakdown)) {
          const entry = priceBreakdown[key];
          if (productNames[entry.productName]) {
            entry.productName = productNames[entry.productName];
          }
        }

        result = {
          total_mrr: totalMRR,
          total_subscribers: totalPayingSubscribers,
          price_breakdown: Object.entries(priceBreakdown).map(([priceId, data]) => ({
            price_id: priceId,
            product_name: data.productName,
            monthly_amount_cents: data.amount,
            subscriber_count: data.count,
            interval: data.interval,
            effective_label: `$${(data.amount / 100).toFixed(2)}/mo${data.discountLabel ? ` (${data.discountLabel})` : ""}`,
            subscribers: data.subscribers.sort((a, b) => (a.email || "").localeCompare(b.email || "")),
          })).sort((a, b) => {
            if (b.subscriber_count !== a.subscriber_count) return b.subscriber_count - a.subscriber_count;
            return b.monthly_amount_cents - a.monthly_amount_cents;
          }),
        };
        break;
      }

      case "list_coupons": {
        const limit = Math.min(Math.max(Number(params?.limit) || 100, 1), 100);
        const coupons = await stripe.coupons.list({ limit });
        // Fetch promotion codes for each coupon (best-effort)
        const enriched = await Promise.all(coupons.data.map(async (c: any) => {
          let promoCodes: any[] = [];
          try {
            const promos = await stripe.promotionCodes.list({ coupon: c.id, limit: 10 });
            promoCodes = promos.data.map((p: any) => ({
              id: p.id,
              code: p.code,
              active: p.active,
              times_redeemed: p.times_redeemed,
              max_redemptions: p.max_redemptions,
              expires_at: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
            }));
          } catch (_) { /* ignore */ }
          return {
            id: c.id,
            name: c.name,
            percent_off: c.percent_off,
            amount_off: c.amount_off,
            currency: c.currency,
            duration: c.duration,
            duration_in_months: c.duration_in_months,
            max_redemptions: c.max_redemptions,
            times_redeemed: c.times_redeemed,
            redeem_by: c.redeem_by ? new Date(c.redeem_by * 1000).toISOString() : null,
            valid: c.valid,
            created: new Date(c.created * 1000).toISOString(),
            promotion_codes: promoCodes,
          };
        }));
        result = { coupons: enriched };
        break;
      }

      case "create_coupon": {
        const p = params || {};
        if (!p.name || typeof p.name !== "string") throw new Error("params.name is required");
        if (!p.percent_off && !p.amount_off) throw new Error("Provide either percent_off or amount_off");
        if (p.percent_off && p.amount_off) throw new Error("Provide only one of percent_off or amount_off");

        const couponParams: any = { name: p.name.trim() };
        if (p.percent_off) {
          const pct = Number(p.percent_off);
          if (!(pct > 0 && pct <= 100)) throw new Error("percent_off must be between 0 and 100");
          couponParams.percent_off = pct;
        } else {
          const amt = Math.round(Number(p.amount_off));
          if (!(amt > 0)) throw new Error("amount_off must be a positive integer (cents)");
          couponParams.amount_off = amt;
          couponParams.currency = (p.currency || "usd").toLowerCase();
        }
        const duration = p.duration || "once";
        if (!["once", "repeating", "forever"].includes(duration)) {
          throw new Error("duration must be once, repeating, or forever");
        }
        couponParams.duration = duration;
        if (duration === "repeating") {
          const months = Math.round(Number(p.duration_in_months));
          if (!(months > 0)) throw new Error("duration_in_months required for repeating");
          couponParams.duration_in_months = months;
        }
        if (p.max_redemptions) couponParams.max_redemptions = Math.round(Number(p.max_redemptions));
        if (p.redeem_by) {
          const ts = Math.floor(new Date(p.redeem_by).getTime() / 1000);
          if (!isNaN(ts)) couponParams.redeem_by = ts;
        }

        const coupon = await stripe.coupons.create(couponParams);

        // Optionally create a customer-facing promotion code
        let promoCode: any = null;
        if (p.promo_code && typeof p.promo_code === "string" && p.promo_code.trim()) {
          const promoParams: any = {
            coupon: coupon.id,
            code: p.promo_code.trim().toUpperCase(),
          };
          if (p.max_redemptions) promoParams.max_redemptions = Math.round(Number(p.max_redemptions));
          if (p.redeem_by) {
            const ts = Math.floor(new Date(p.redeem_by).getTime() / 1000);
            if (!isNaN(ts)) promoParams.expires_at = ts;
          }
          promoCode = await stripe.promotionCodes.create(promoParams);
        }

        result = { success: true, coupon, promotion_code: promoCode };
        break;
      }

      case "delete_coupon": {
        const couponId = params?.coupon_id;
        if (!couponId) throw new Error("params.coupon_id is required");
        const deleted = await stripe.coupons.del(couponId);
        result = { success: true, deleted };
        break;
      }

      case "toggle_promotion_code": {
        const promoId = params?.promotion_code_id;
        if (!promoId) throw new Error("params.promotion_code_id is required");
        const active = !!params?.active;
        const updated = await stripe.promotionCodes.update(promoId, { active });
        result = { success: true, promotion_code: updated };
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
