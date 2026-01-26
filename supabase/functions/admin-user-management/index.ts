import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "get_user_details" | "get_stripe_info" | "refund" | "cancel_subscription" | "give_credit" | "update_subscription" | "send_email" | "list_users" | "get_audit_logs" | "get_user_activity";
  userId?: string;
  userEmail?: string;
  refundAmount?: number;
  creditMonths?: number;
  newTier?: string;
  emailTemplate?: string;
  customMessage?: string;
  // Filters for list_users
  filters?: {
    subscriptionStatus?: string;
    planTier?: string;
    dateFrom?: string;
    dateTo?: string;
  };
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
    const { action, userId, userEmail, filters } = body;

    logStep("Processing action", { action, userId, userEmail, filters });

    // Helper to log admin actions
    const logAdminAction = async (
      targetUserId: string | null,
      targetUserEmail: string | null,
      actionName: string,
      actionCategory: string,
      details: Record<string, unknown> = {}
    ) => {
      try {
        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: userData.user.id,
          admin_email: userData.user.email || "unknown",
          target_user_id: targetUserId,
          target_user_email: targetUserEmail,
          action: actionName,
          action_category: actionCategory,
          details,
        });
      } catch (err) {
        logStep("Failed to log audit action", { error: err });
      }
    };

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
      
      // Log audit action
      await logAdminAction(userId || null, userEmail, "Refund processed", "billing", {
        refund_id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        payment_intent_id: payment.id,
      });

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
      
      // Log audit action
      await logAdminAction(userId || null, userEmail, "Subscription cancelled", "subscription", {
        subscription_id: cancelled.id,
      });

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
      
      // Log audit action
      await logAdminAction(userId || null, userEmail, "Credit applied", "billing", {
        credit_amount: creditAmount / 100,
        months: body.creditMonths,
      });

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
      
      // Log audit action
      await logAdminAction(userId || null, userEmail, "Subscription tier updated", "subscription", {
        new_tier: body.newTier,
      });

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
      
      // Log audit action
      await logAdminAction(userId || null, userEmail, "Email sent", "communication", {
        template: body.emailTemplate,
        subject: template.subject,
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Email sent to ${userEmail}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List users with filters
    if (action === "list_users") {
      let query = supabaseAdmin
        .from("profiles")
        .select(`
          id, email, full_name, created_at
        `)
        .order("created_at", { ascending: false });

      // Date filters
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      // Get subscriptions for all users
      const { data: subscriptions } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, tier, status, stripe_subscription_id, current_period_end");

      const subscriptionMap = new Map();
      subscriptions?.forEach((sub: any) => {
        subscriptionMap.set(sub.user_id, sub);
      });

      // Apply subscription filters and combine data
      let combinedUsers = profiles?.map((profile: any) => ({
        ...profile,
        subscription: subscriptionMap.get(profile.id) || null,
      })) || [];

      // Filter by subscription status
      if (filters?.subscriptionStatus) {
        if (filters.subscriptionStatus === "none") {
          combinedUsers = combinedUsers.filter((u: any) => !u.subscription);
        } else {
          combinedUsers = combinedUsers.filter((u: any) => 
            u.subscription?.status === filters.subscriptionStatus
          );
        }
      }

      // Filter by plan tier
      if (filters?.planTier) {
        combinedUsers = combinedUsers.filter((u: any) => 
          u.subscription?.tier === filters.planTier
        );
      }

      return new Response(JSON.stringify({ users: combinedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get audit logs
    if (action === "get_audit_logs") {
      const { data: logs, error: logsError } = await supabaseAdmin
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      return new Response(JSON.stringify({ logs: logs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user activity timeline
    if (action === "get_user_activity") {
      if (!userId) throw new Error("userId required");

      // Get brand for this user
      const { data: brand } = await supabaseAdmin
        .from("brands")
        .select("id, name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const brandId = brand?.id;

      // Fetch all activity data in parallel
      const [
        campaignsResult,
        offersResult,
        subscriptionResult,
        bugReportsResult,
        profileResult,
      ] = await Promise.all([
        // Campaigns created
        brandId
          ? supabaseAdmin
              .from("campaign_workspaces")
              .select("id, name, created_at, progress_status, meta_campaign_status, published_at")
              .eq("brand_id", brandId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] }),
        // Offers created
        brandId
          ? supabaseAdmin
              .from("offers")
              .select("id, name, created_at")
              .eq("brand_id", brandId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] }),
        // Subscription history
        supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        // Bug reports
        supabaseAdmin
          .from("bug_reports")
          .select("id, created_at, status, priority")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        // Profile for signup date
        supabaseAdmin
          .from("profiles")
          .select("created_at, email")
          .eq("id", userId)
          .single(),
      ]);

      // Build activity timeline
      const activities: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
      }> = [];

      // Add signup event
      if (profileResult.data) {
        activities.push({
          id: `signup-${userId}`,
          type: "signup",
          title: "Account Created",
          description: `User signed up with ${profileResult.data.email}`,
          timestamp: profileResult.data.created_at,
        });
      }

      // Add brand creation
      if (brand) {
        activities.push({
          id: `brand-${brand.id}`,
          type: "brand",
          title: "Brand Created",
          description: `Created brand "${brand.name}"`,
          timestamp: brand.created_at,
        });
      }

      // Add campaigns
      if (campaignsResult.data) {
        for (const campaign of campaignsResult.data) {
          activities.push({
            id: `campaign-${campaign.id}`,
            type: "campaign",
            title: "Campaign Created",
            description: `Created campaign "${campaign.name}"`,
            timestamp: campaign.created_at,
            metadata: {
              status: campaign.progress_status,
              metaStatus: campaign.meta_campaign_status,
            },
          });

          // Add published event if applicable
          if (campaign.published_at) {
            activities.push({
              id: `campaign-published-${campaign.id}`,
              type: "campaign_published",
              title: "Campaign Published",
              description: `Published campaign "${campaign.name}" to Meta`,
              timestamp: campaign.published_at,
            });
          }
        }
      }

      // Add offers
      if (offersResult.data) {
        for (const offer of offersResult.data) {
          activities.push({
            id: `offer-${offer.id}`,
            type: "offer",
            title: "Offer Created",
            description: `Created offer "${offer.name}"`,
            timestamp: offer.created_at,
          });
        }
      }

      // Add subscription events
      if (subscriptionResult.data) {
        for (const sub of subscriptionResult.data) {
          activities.push({
            id: `subscription-${sub.id}`,
            type: "subscription",
            title: "Subscription Started",
            description: `Started ${sub.tier} plan`,
            timestamp: sub.created_at,
            metadata: { tier: sub.tier, status: sub.status },
          });
        }
      }

      // Add bug reports
      if (bugReportsResult.data) {
        for (const bug of bugReportsResult.data) {
          activities.push({
            id: `bug-${bug.id}`,
            type: "bug_report",
            title: "Bug Report Submitted",
            description: `Submitted a ${bug.priority || "normal"} priority bug report`,
            timestamp: bug.created_at,
            metadata: { status: bug.status, priority: bug.priority },
          });
        }
      }

      // Sort by timestamp descending
      activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return new Response(JSON.stringify({ activities }), {
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
