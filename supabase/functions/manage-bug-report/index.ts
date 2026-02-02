import { Resend } from 'https://esm.sh/resend@2.0.0';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface ManageRequest {
  action: 'update_status' | 'send_email' | 'refund' | 'cancel_subscription' | 'give_credit';
  reportId: string;
  status?: string;
  priority?: string;
  resolutionNotes?: string;
  emailTemplate?: string;
  customMessage?: string;
  refundAmount?: number;
  creditMonths?: number;
}

// Email templates
const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  fixed: {
    subject: "✅ Your Bug Report Has Been Resolved",
    body: `Great news! The issue you reported has been fixed.

We've pushed an update that should resolve the problem you experienced. Please try again and let us know if you run into any other issues.

Thank you for helping us improve Lumi!`
  },
  working_on_it: {
    subject: "🔧 We're Working on Your Bug Report",
    body: `Thank you for reporting this issue. Our team is actively investigating and working on a fix.

We'll follow up with you as soon as it's resolved. In the meantime, if you have any additional details that might help us, please reply to this email.

We appreciate your patience!`
  },
  need_more_info: {
    subject: "❓ We Need More Information About Your Bug Report",
    body: `Thank you for reporting this issue. To help us resolve it faster, we need a bit more information.

Could you please reply with:
• The exact steps you took before the issue occurred
• Any error messages you saw
• A screenshot if possible

This will help us reproduce and fix the issue quickly. Thanks for your help!`
  },
  cannot_reproduce: {
    subject: "🔍 Update on Your Bug Report",
    body: `We've been investigating the issue you reported, but we're having trouble reproducing it on our end.

This doesn't mean the issue isn't real — it might be related to specific conditions or timing. Could you let us know if:
• The issue is still happening
• Any specific steps that trigger it
• What device/browser you're using

If you're no longer experiencing the problem, it may have been resolved in a recent update. Please let us know either way!`
  },
  refund_issued: {
    subject: "💰 Refund Processed for Your Account",
    body: `We've processed a refund for your account due to the issues you experienced.

The refund should appear in your original payment method within 5-10 business days, depending on your bank.

We're sorry for any inconvenience and appreciate your patience. If you have any questions, please reply to this email.`
  },
  credit_applied: {
    subject: "🎁 Free Month Credit Applied to Your Account",
    body: `As a thank you for your patience and for helping us improve Lumi, we've applied a free month credit to your account.

Your next billing date has been extended accordingly. You don't need to do anything — the credit has already been applied.

Thank you for being a valued member of our community!`
  }
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Admin access required');
    }

    const body: ManageRequest = await req.json();
    const { action, reportId, status, priority, resolutionNotes, emailTemplate, customMessage, refundAmount, creditMonths } = body;

    // Get the bug report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      throw new Error('Bug report not found');
    }

    const userEmail = report.user_email;

    switch (action) {
      case 'update_status': {
        const updates: any = { updated_at: new Date().toISOString() };
        if (status) updates.status = status;
        if (priority) updates.priority = priority;
        if (resolutionNotes !== undefined) updates.resolution_notes = resolutionNotes;
        if (status === 'resolved') updates.resolved_at = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
          .from('bug_reports')
          .update(updates)
          .eq('id', reportId);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ success: true, message: 'Status updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send_email': {
        let subject: string;
        let body: string;

        if (emailTemplate && EMAIL_TEMPLATES[emailTemplate]) {
          subject = EMAIL_TEMPLATES[emailTemplate].subject;
          body = EMAIL_TEMPLATES[emailTemplate].body;
        } else if (customMessage) {
          subject = "Update on Your Bug Report - Lumi";
          body = customMessage;
        } else {
          throw new Error('Email template or custom message required');
        }

        // Add custom message to template if both provided
        if (emailTemplate && customMessage) {
          body += `\n\n---\n\n${customMessage}`;
        }

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #8B5CF6, #D946EF); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Lumi Support</h1>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">Hi there,</p>
              <div style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${body}</div>
              <p style="margin: 24px 0 0 0; color: #374151;">Best,<br/>The Lumi Team</p>
            </div>
            <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">Lumi • Meta Ads, Simplified</p>
            </div>
          </div>
        `;

        await resend.emails.send({
          from: 'Lumi Support <support@adsbylumi.com>',
          to: [userEmail],
          subject,
          html: emailHtml,
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Email sent' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'refund': {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2025-08-27.basil',
        });

        // Find customer by email
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length === 0) {
          throw new Error('No Stripe customer found for this email');
        }

        const customerId = customers.data[0].id;

        // Get recent payments
        const paymentIntents = await stripe.paymentIntents.list({
          customer: customerId,
          limit: 10,
        });

        const successfulPayment = paymentIntents.data.find((pi: any) => pi.status === 'succeeded');
        if (!successfulPayment) {
          throw new Error('No successful payment found to refund');
        }

        // Create refund
        const refund = await stripe.refunds.create({
          payment_intent: successfulPayment.id,
          amount: refundAmount ? refundAmount * 100 : undefined, // Convert to cents, or full refund if not specified
          reason: 'requested_by_customer',
        });

        // Update bug report
        await supabaseAdmin
          .from('bug_reports')
          .update({
            resolution_notes: `${resolutionNotes || ''}\n\nRefund issued: $${(refund.amount / 100).toFixed(2)}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reportId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Refund of $${(refund.amount / 100).toFixed(2)} processed`,
            refundId: refund.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel_subscription': {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2025-08-27.basil',
        });

        // Find customer by email
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length === 0) {
          throw new Error('No Stripe customer found for this email');
        }

        const customerId = customers.data[0].id;

        // Get active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length === 0) {
          throw new Error('No active subscription found');
        }

        // Cancel at period end (graceful cancellation)
        const canceled = await stripe.subscriptions.update(subscriptions.data[0].id, {
          cancel_at_period_end: true,
        });

        // Update bug report
        await supabaseAdmin
          .from('bug_reports')
          .update({
            resolution_notes: `${resolutionNotes || ''}\n\nSubscription set to cancel at period end`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reportId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Subscription will cancel at period end',
            cancelAt: new Date(canceled.current_period_end * 1000).toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'give_credit': {
        const months = creditMonths || 1;
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2025-08-27.basil',
        });

        // Find customer by email
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length === 0) {
          throw new Error('No Stripe customer found for this email');
        }

        const customerId = customers.data[0].id;

        // Get active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length === 0) {
          throw new Error('No active subscription found');
        }

        const subscription = subscriptions.data[0];
        
        // Get the subscription's monthly price to calculate credit amount
        const priceId = subscription.items.data[0]?.price?.id;
        if (!priceId) {
          throw new Error('Unable to determine subscription price');
        }
        
        const price = await stripe.prices.retrieve(priceId);
        const monthlyAmount = price.unit_amount || 0; // Amount in cents
        const creditAmount = monthlyAmount * months;

        // Apply credit to customer balance (negative = credit)
        await stripe.customers.update(customerId, {
          balance: (customers.data[0].balance || 0) - creditAmount,
        });

        // Update bug report
        await supabaseAdmin
          .from('bug_reports')
          .update({
            resolution_notes: `${resolutionNotes || ''}\n\n${months} month(s) credit applied ($${(creditAmount / 100).toFixed(2)})`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reportId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `${months} month(s) credit applied ($${(creditAmount / 100).toFixed(2)})`,
            creditAmount: creditAmount / 100
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error: any) {
    console.error('Error managing bug report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
