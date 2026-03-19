import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  action: "get_user_details" | "get_stripe_info" | "refund" | "cancel_subscription" | "give_credit" | "update_subscription" | "send_email" | "list_users" | "get_audit_logs" | "get_user_activity" | "delete_user" | "toggle_agency_mode" | "manage_role" | "archive_user" | "unarchive_user";
  userId?: string;
  userEmail?: string;
  refundAmount?: number;
  creditMonths?: number;
  newTier?: string;
  emailTemplate?: string;
  customMessage?: string;
  isAgencyUser?: boolean;
  role?: string;
  roleAction?: "add" | "remove";
  filters?: {
    subscriptionStatus?: string;
    planTier?: string;
    dateFrom?: string;
    dateTo?: string;
    showArchived?: boolean;
  };
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[ADMIN-USER-MGMT] ${step}`, details ? JSON.stringify(details) : "");
};

// Actions that moderators are allowed to perform
const MODERATOR_ALLOWED_ACTIONS = new Set([
  "list_users",
  "get_user_details",
  "get_stripe_info",
  "get_audit_logs",
  "get_user_activity",
  "send_email",
]);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin/moderator access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    // Check for admin or moderator role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "moderator"]);

    const userRoles = roles?.map((r: any) => r.role) || [];
    const isAdmin = userRoles.includes("admin");
    const isModerator = userRoles.includes("moderator");

    if (!isAdmin && !isModerator) throw new Error("Admin or moderator access required");

    const body: RequestBody = await req.json();
    const { action, userId, userEmail, filters } = body;

    // Moderator permission check
    if (!isAdmin && !MODERATOR_ALLOWED_ACTIONS.has(action)) {
      throw new Error("This action requires admin access");
    }

    logStep("Processing action", { action, userId, userEmail, filters, callerRole: isAdmin ? "admin" : "moderator" });

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

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*, is_agency_user, archived, archived_at")
        .eq("id", userId)
        .single();

      // Get user roles
      const { data: userRolesData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const { data: brand } = await supabaseAdmin
        .from("brands")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: bugReports } = await supabaseAdmin
        .from("bug_reports")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const { data: adminNotes } = await supabaseAdmin
        .from("admin_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const { data: campaigns } = await supabaseAdmin
        .from("campaign_workspaces")
        .select("id, name, progress_status, created_at, meta_campaign_status")
        .eq("brand_id", brand?.id || "")
        .order("created_at", { ascending: false })
        .limit(10);

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
        roles: userRolesData?.map((r: any) => r.role) || [],
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

      if (userId) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", cancel_at_period_end: true })
          .eq("user_id", userId);
      }

      logStep("Subscription cancelled", { subscriptionId: cancelled.id });

      // Get user profile for email details
      let fullName = "";
      let tierName = "";
      let periodEnd = cancelled.current_period_end
        ? new Date(cancelled.current_period_end * 1000).toISOString()
        : null;

      if (userId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .single();
        fullName = profile?.full_name || "";

        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("tier")
          .eq("user_id", userId)
          .single();
        tierName = sub?.tier || "";
      }

      // Pause ads and send cancellation email
      try {
        const cancellationRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-cancellation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              userId,
              userEmail,
              fullName,
              tierName,
              periodEnd,
            }),
          }
        );
        const cancellationData = await cancellationRes.json();
        logStep("Handle-cancellation result", cancellationData);
      } catch (cancelErr) {
        logStep("Error calling handle-cancellation", { error: cancelErr });
      }
      
      await logAdminAction(userId || null, userEmail, "Subscription cancelled", "subscription", {
        subscription_id: cancelled.id,
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Subscription cancelled for ${userEmail}. Ads have been paused.`,
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

      const creditAmount = price.unit_amount * body.creditMonths;
      
      await stripe.customers.update(customers.data[0].id, {
        balance: (customers.data[0].balance || 0) - creditAmount,
      });

      logStep("Credit applied", { amount: creditAmount, months: body.creditMonths });
      
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

      if (userId) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ tier: body.newTier })
          .eq("user_id", userId);
      }
      
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
        .select(`id, email, full_name, created_at, archived, archived_at`)
        .order("created_at", { ascending: false });

      // Archive filter - default to hiding archived
      if (!filters?.showArchived) {
        query = query.or("archived.is.null,archived.eq.false");
      }

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

      // Get roles for all users with elevated roles
      const { data: allRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "moderator"]);

      const rolesMap = new Map<string, string[]>();
      allRoles?.forEach((r: any) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      let combinedUsers = profiles?.map((profile: any) => ({
        ...profile,
        subscription: subscriptionMap.get(profile.id) || null,
        roles: rolesMap.get(profile.id) || [],
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

      const { data: brand } = await supabaseAdmin
        .from("brands")
        .select("id, name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const brandId = brand?.id;

      const [
        campaignsResult,
        offersResult,
        subscriptionResult,
        bugReportsResult,
        profileResult,
      ] = await Promise.all([
        brandId
          ? supabaseAdmin
              .from("campaign_workspaces")
              .select("id, name, created_at, progress_status, meta_campaign_status, published_at")
              .eq("brand_id", brandId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] }),
        brandId
          ? supabaseAdmin
              .from("offers")
              .select("id, name, created_at")
              .eq("brand_id", brandId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] }),
        supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("bug_reports")
          .select("id, created_at, status, priority")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("profiles")
          .select("created_at, email")
          .eq("id", userId)
          .single(),
      ]);

      const activities: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
      }> = [];

      if (profileResult.data) {
        activities.push({
          id: `signup-${userId}`,
          type: "signup",
          title: "Account Created",
          description: `User signed up with ${profileResult.data.email}`,
          timestamp: profileResult.data.created_at,
        });
      }

      if (brand) {
        activities.push({
          id: `brand-${brand.id}`,
          type: "brand",
          title: "Brand Created",
          description: `Created brand "${brand.name}"`,
          timestamp: brand.created_at,
        });
      }

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

      activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return new Response(JSON.stringify({ activities }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete user account completely
    if (action === "delete_user") {
      if (!userId) throw new Error("userId required");

      logStep("Starting user deletion", { userId });

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      const targetEmail = profile?.email || userEmail || "unknown";
      const targetName = profile?.full_name || "Unknown User";

      if (targetEmail && targetEmail !== "unknown") {
        try {
          const customers = await stripe.customers.list({ email: targetEmail, limit: 1 });
          if (customers.data.length > 0) {
            const subscriptions = await stripe.subscriptions.list({
              customer: customers.data[0].id,
              status: "active",
              limit: 10,
            });

            for (const sub of subscriptions.data) {
              await stripe.subscriptions.cancel(sub.id);
              logStep("Cancelled Stripe subscription", { subscriptionId: sub.id });
            }
          }
        } catch (stripeError) {
          logStep("Error cancelling Stripe subscriptions", { error: stripeError });
        }
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        logStep("Failed to delete user", { error: deleteError.message });
        throw new Error(`Failed to delete user: ${deleteError.message}`);
      }

      logStep("User deleted successfully", { userId, email: targetEmail });

      await logAdminAction(userId, targetEmail, "User account deleted", "subscription", {
        user_name: targetName,
        user_email: targetEmail,
        deleted_by: userData.user.email,
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Account for ${targetEmail} has been permanently deleted`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Toggle agency mode for a user
    if (action === "toggle_agency_mode") {
      if (!userId) throw new Error("userId required");
      const isAgency = body.isAgencyUser ?? false;

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ is_agency_user: isAgency })
        .eq("id", userId);

      if (updateError) throw updateError;

      logStep("Agency mode toggled", { userId, isAgencyUser: isAgency });

      await logAdminAction(userId, userEmail || null, isAgency ? "Agency mode enabled" : "Agency mode disabled", "subscription", {
        is_agency_user: isAgency,
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Agency mode ${isAgency ? "enabled" : "disabled"} for user`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manage roles (admin only)
    if (action === "manage_role") {
      if (!isAdmin) throw new Error("Only admins can manage roles");
      if (!userId || !body.role || !body.roleAction) throw new Error("userId, role, and roleAction required");

      const validRoles = ["admin", "moderator"];
      if (!validRoles.includes(body.role)) throw new Error("Invalid role. Must be 'admin' or 'moderator'");

      // Prevent removing your own admin role
      if (body.roleAction === "remove" && userId === userData.user.id && body.role === "admin") {
        throw new Error("You cannot remove your own admin role");
      }

      if (body.roleAction === "add") {
        // Check if already has this role
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", body.role)
          .maybeSingle();

        if (existingRole) {
          return new Response(JSON.stringify({
            success: true,
            message: `User already has the ${body.role} role`,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: insertError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: body.role });

        if (insertError) throw insertError;

        logStep("Role added", { userId, role: body.role });
        await logAdminAction(userId, userEmail || null, `Role added: ${body.role}`, "role_management", {
          role: body.role,
          action: "add",
        });

        return new Response(JSON.stringify({
          success: true,
          message: `${body.role} role granted`,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Remove role
        const { error: deleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", body.role);

        if (deleteError) throw deleteError;

        logStep("Role removed", { userId, role: body.role });
        await logAdminAction(userId, userEmail || null, `Role removed: ${body.role}`, "role_management", {
          role: body.role,
          action: "remove",
        });

        return new Response(JSON.stringify({
          success: true,
          message: `${body.role} role revoked`,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Archive user
    if (action === "archive_user") {
      if (!userId) throw new Error("userId required");

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateError) throw updateError;

      logStep("User archived", { userId });
      await logAdminAction(userId, userEmail || null, "User archived", "user_management", {});

      return new Response(JSON.stringify({
        success: true,
        message: "User archived",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unarchive user
    if (action === "unarchive_user") {
      if (!userId) throw new Error("userId required");

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ archived: false, archived_at: null })
        .eq("id", userId);

      if (updateError) throw updateError;

      logStep("User unarchived", { userId });
      await logAdminAction(userId, userEmail || null, "User unarchived", "user_management", {});

      return new Response(JSON.stringify({
        success: true,
        message: "User unarchived",
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
