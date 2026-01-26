import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "get_user_details" | "get_stripe_info" | "refund" | "cancel_subscription" | "give_credit" | "update_subscription" | "send_email";
  userId?: string;
  userEmail?: string;
  refundAmount?: number;
  creditMonths?: number;
  newTier?: string;
  emailTemplate?: string;
  customMessage?: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[ADMIN-USER-MGMT] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Admin access required");

    const body: RequestBody = await req.json();
    const { action, userId, userEmail } = body;

    logStep("Processing action", { action, userId, userEmail });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get Stripe customer info
    const getStripeInfo = async (email: string) => {
      logStep("Fetching Stripe info for", { email });
      
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) {
        return { customer: null, subscriptions: [], payments: [], invoices: [] };
      }

      const customer = customers.data[0];
      
      const [subscriptions, payments, invoices] = await Promise.all([
        stripe.subscriptions.list({ customer: customer.id, limit: 10, status: "all" }),
        stripe.paymentIntents.list({ customer: customer.id, limit: 20 }),
        stripe.invoices.list({ customer: customer.id, limit: 20 }),
      ]);

      return {
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          created: customer.created,
          balance: customer.balance,
          currency: customer.currency,
          default_source: customer.default_source,
          metadata: customer.metadata,
        },
        subscriptions: subscriptions.data.map((sub: any) => ({
          id: sub.id,
          status: sub.status,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: sub.canceled_at,
          created: sub.created,
          plan: sub.items.data[0]?.price ? {
            id: sub.items.data[0].price.id,
            amount: sub.items.data[0].price.unit_amount,
            currency: sub.items.data[0].price.currency,
            interval: sub.items.data[0].price.recurring?.interval,
            product: sub.items.data[0].price.product,
          } : null,
        })),
        payments: payments.data.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          created: p.created,
          description: p.description,
        })),
        invoices: invoices.data.map((inv: any) => ({
          id: inv.id,
          number: inv.number,
          amount_due: inv.amount_due,
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          created: inv.created,
          hosted_invoice_url: inv.hosted_invoice_url,
        })),
      };
    };

    if (action === "get_user_details") {
      if (!userId) throw new Error("userId required");

      // Get profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // Get brand
      const { data: brand } = await supabaseAdmin
        .from("brands")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get subscription
      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get bug reports
      const { data: bugReports } = await supabaseAdmin
        .from("bug_reports")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      // Get admin notes
      const { data: adminNotes } = await supabaseAdmin
        .from("admin_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      // Get campaigns
      const { data: campaigns } = await supabaseAdmin
        .from("campaign_workspaces")
        .select("id, name, progress_status, created_at, meta_campaign_status")
        .eq("brand_id", brand?.id || "")
        .order("created_at", { ascending: false })
        .limit(10);

      // Get Stripe info if email available
      let stripeInfo = null;
      if (profile?.email) {
        stripeInfo = await getStripeInfo(profile.email);
      }

      return new Response(JSON.stringify({
        profile,
        brand,
        subscription,
        bugReports: bugReports || [],
        adminNotes: adminNotes || [],
        campaigns: campaigns || [],
        stripeInfo,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_stripe_info") {
      if (!userEmail) throw new Error("userEmail required");
      const stripeInfo = await getStripeInfo(userEmail);
      return new Response(JSON.stringify(stripeInfo), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refund") {
      if (!userEmail) throw new Error("userEmail required");
      
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length === 0) throw new Error("No Stripe customer found");

      const payments = await stripe.paymentIntents.list({
        customer: customers.data[0].id,
        limit: 1,
      });

      if (payments.data.length === 0) throw new Error("No payments found to refund");

      const payment = payments.data[0];
      const refundAmount = body.refundAmount ? Math.round(body.refundAmount * 100) : undefined;

      const refund = await stripe.refunds.create({
        payment_intent: payment.id,
        amount: refundAmount,
        reason: "requested_by_customer",
      });

      logStep("Refund created", { refundId: refund.id, amount: refund.amount });

      return new Response(JSON.stringify({
        success: true,
        message: `Refunded $${(refund.amount / 100).toFixed(2)} to ${userEmail}`,
        refund,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel_subscription") {
      if (!userEmail) throw new Error("userEmail required");

      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length === 0) throw new Error("No Stripe customer found");

      const subscriptions = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length === 0) throw new Error("No active subscription found");

      const cancelled = await stripe.subscriptions.cancel(subscriptions.data[0].id);

      // Update local subscription record
      if (userId) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", cancel_at_period_end: true })
          .eq("user_id", userId);
      }

      logStep("Subscription cancelled", { subscriptionId: cancelled.id });

      return new Response(JSON.stringify({
        success: true,
        message: `Subscription cancelled for ${userEmail}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "give_credit") {
      if (!userEmail || !body.creditMonths) throw new Error("userEmail and creditMonths required");

      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length === 0) throw new Error("No Stripe customer found");

      const subscriptions = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length === 0) throw new Error("No active subscription found");

      const sub = subscriptions.data[0];
      const price = sub.items.data[0]?.price;
      
      if (!price?.unit_amount) throw new Error("Could not determine subscription price");

      // Create a credit for the subscription amount * months
      const creditAmount = price.unit_amount * body.creditMonths;
      
      await stripe.customers.update(customers.data[0].id, {
        balance: (customers.data[0].balance || 0) - creditAmount,
      });

      logStep("Credit applied", { amount: creditAmount, months: body.creditMonths });

      return new Response(JSON.stringify({
        success: true,
        message: `Applied $${(creditAmount / 100).toFixed(2)} credit (${body.creditMonths} month(s)) to ${userEmail}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_subscription") {
      if (!userEmail || !body.newTier) throw new Error("userEmail and newTier required");

      // Update local subscription
      if (userId) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ tier: body.newTier })
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Subscription tier updated to ${body.newTier} for ${userEmail}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_email") {
      if (!userEmail || !body.emailTemplate) throw new Error("userEmail and emailTemplate required");

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

      const templates: Record<string, { subject: string; body: string }> = {
        welcome: {
          subject: "Welcome to Lumi! 🎉",
          body: `Hi there!\n\nWelcome to Lumi! We're so excited to have you on board.\n\nIf you have any questions or need help getting started, just reply to this email.\n\nBest,\nThe Lumi Team`,
        },
        credit_applied: {
          subject: "Your Account Credit Has Been Applied ✨",
          body: `Hi there!\n\nGreat news! We've applied a credit to your account.\n\nThis credit will automatically be applied to your next billing cycle.\n\nIf you have any questions, just reply to this email.\n\nBest,\nThe Lumi Team`,
        },
        refund_processed: {
          subject: "Your Refund Has Been Processed 💰",
          body: `Hi there!\n\nWe've processed your refund request. The funds should appear in your account within 5-10 business days.\n\nIf you have any questions, just reply to this email.\n\nBest,\nThe Lumi Team`,
        },
        subscription_cancelled: {
          subject: "Your Subscription Has Been Cancelled",
          body: `Hi there!\n\nAs requested, we've cancelled your subscription. You'll continue to have access until the end of your current billing period.\n\nWe'd love to have you back anytime! If you have feedback on how we can improve, please reply to this email.\n\nBest,\nThe Lumi Team`,
        },
        follow_up: {
          subject: "Following Up From Lumi Support 💬",
          body: `Hi there!\n\nJust wanted to follow up and make sure everything is working well for you.\n\nIs there anything else we can help with?\n\nBest,\nThe Lumi Team`,
        },
        custom: {
          subject: "Message From Lumi Support",
          body: body.customMessage || "",
        },
      };

      const template = templates[body.emailTemplate];
      if (!template) throw new Error("Invalid email template");

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Lumi Support <support@adsbylumi.com>",
          to: [userEmail],
          subject: template.subject,
          text: template.body,
        }),
      });

      if (!emailRes.ok) {
        const error = await emailRes.text();
        throw new Error(`Failed to send email: ${error}`);
      }

      logStep("Email sent", { template: body.emailTemplate, to: userEmail });

      return new Response(JSON.stringify({
        success: true,
        message: `Email sent to ${userEmail}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logStep("Error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
