import { Resend } from 'npm:resend@2.0.0';
import Stripe from 'https://esm.sh/stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { logEmail } from '../_shared/log-email.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TRIAL-REMINDERS] ${step}${detailsStr}`);
};

// Which days (since trial start) to send emails
const SEND_DAYS = [0, 3, 5, 7];

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all trialing subscriptions from Stripe
    const trialingSubs: any[] = [];
    for await (const sub of stripe.subscriptions.list({ status: 'trialing', limit: 100 })) {
      trialingSubs.push(sub);
    }

    logStep('Found trialing subscriptions', { count: trialingSubs.length });

    let sentCount = 0;

    for (const sub of trialingSubs) {
      try {
        const customerEmail = typeof sub.customer === 'string'
          ? (await stripe.customers.retrieve(sub.customer) as any).email
          : sub.customer?.email;

        if (!customerEmail) continue;

        // Calculate days since trial start
        const trialStart = new Date(sub.trial_start * 1000);
        const now = new Date();
        const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));

        // Only send on exact days from schedule
        if (!SEND_DAYS.includes(daysSinceStart)) continue;

        // Check if we already sent this day's email
        const { data: existingLog } = await supabase
          .from('email_logs')
          .select('id')
          .eq('recipient_email', customerEmail)
          .eq('email_type', `trial_reminder_day_${daysSinceStart}`)
          .eq('status', 'sent')
          .limit(1)
          .maybeSingle();

        if (existingLog) continue;

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('email', customerEmail)
          .maybeSingle();

        const firstName = profile?.full_name?.split(' ')[0] || 'there';
        const userId = profile?.id;

        // Check milestones for this user
        const milestones = userId ? await checkMilestones(supabase, userId) : {
          brandSetUp: false,
          offerAdded: false,
          metaConnected: false,
          adPublished: false,
        };

        const daysLeft = 7 - daysSinceStart;
        const emailContent = getTrialEmail(daysSinceStart, firstName, daysLeft, milestones);

        const { error: emailError } = await resend.emails.send({
          from: 'Lumi <hello@adsbylumi.com>',
          to: [customerEmail],
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (emailError) {
          logStep('Email send failed', { email: customerEmail, day: daysSinceStart, error: emailError.message });
          await logEmail({
            recipient_email: customerEmail,
            recipient_user_id: userId || undefined,
            email_type: `trial_reminder_day_${daysSinceStart}`,
            subject: emailContent.subject,
            status: 'failed',
            error_message: emailError.message,
            edge_function: 'send-trial-reminders',
            metadata: { day: daysSinceStart },
          });
          continue;
        }

        await logEmail({
          recipient_email: customerEmail,
          recipient_name: profile?.full_name || undefined,
          recipient_user_id: userId || undefined,
          email_type: `trial_reminder_day_${daysSinceStart}`,
          subject: emailContent.subject,
          status: 'sent',
          edge_function: 'send-trial-reminders',
          metadata: { day: daysSinceStart, milestones },
        });

        logStep('Sent trial email', { email: customerEmail, day: daysSinceStart });
        sentCount++;
      } catch (subErr: any) {
        logStep('Error processing subscription', { error: subErr.message });
      }
    }

    logStep('Complete', { sentCount });
    return new Response(
      JSON.stringify({ sent: sentCount, checked: trialingSubs.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    logStep('ERROR', { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface Milestones {
  brandSetUp: boolean;
  offerAdded: boolean;
  metaConnected: boolean;
  adPublished: boolean;
}

async function checkMilestones(supabase: any, userId: string): Promise<Milestones> {
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, website_url, industry, value_proposition, meta_account_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const brandSetUp = !!(brand?.name && brand?.website_url && brand?.industry && brand?.value_proposition);
  const metaConnected = !!brand?.meta_account_id;

  let offerAdded = false;
  let adPublished = false;

  if (brand) {
    const { count: offerCount } = await supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('archived', false);
    offerAdded = (offerCount || 0) > 0;

    const { count: publishedCount } = await supabase
      .from('campaign_workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .not('published_at', 'is', null);
    adPublished = (publishedCount || 0) > 0;
  }

  return { brandSetUp, offerAdded, metaConnected, adPublished };
}

function getTrialEmail(
  day: number,
  firstName: string,
  daysLeft: number,
  milestones: Milestones
): { subject: string; html: string } {
  const completedCount = Object.values(milestones).filter(Boolean).length;

  switch (day) {
    case 0:
      return {
        subject: `Welcome to your free trial, ${firstName}! 🎉`,
        html: buildTrialEmail(firstName, {
          headline: 'Your 7-day free trial has started!',
          subheadline: "Let's get your ads live before it ends.",
          body: "You've got 7 days to experience Lumi — completely free. Here's your quick-start checklist to make the most of your trial:",
          steps: [
            { label: 'Set up your brand profile', done: milestones.brandSetUp },
            { label: 'Add your first offer', done: milestones.offerAdded },
            { label: 'Connect your Meta ad account', done: milestones.metaConnected },
            { label: 'Publish your first campaign', done: milestones.adPublished },
          ],
          ctaText: 'Get Started →',
          ctaUrl: 'https://adsbylumi.com/dashboard',
          urgencyNote: null,
        }),
      };
    case 3:
      return {
        subject: `3 days in — here's your next step, ${firstName} 🎯`,
        html: buildTrialEmail(firstName, {
          headline: "You're 3 days into your trial",
          subheadline: `${completedCount}/4 steps done — ${daysLeft} days left.`,
          body: getMilestoneNudge(milestones),
          steps: [
            { label: 'Set up your brand profile', done: milestones.brandSetUp },
            { label: 'Add your first offer', done: milestones.offerAdded },
            { label: 'Connect your Meta ad account', done: milestones.metaConnected },
            { label: 'Publish your first campaign', done: milestones.adPublished },
          ],
          ctaText: getNextActionCta(milestones),
          ctaUrl: getNextActionUrl(milestones),
          urgencyNote: null,
        }),
      };
    case 5:
      return {
        subject: `2 days left — let's get your ads live! ⚡`,
        html: buildTrialEmail(firstName, {
          headline: 'Only 2 days left in your trial',
          subheadline: `${completedCount}/4 steps done — let's finish strong.`,
          body: milestones.adPublished
            ? "Your ads are live — amazing work! Your trial converts to a paid subscription in 2 days. No action needed if you want to keep going."
            : "You're almost there. Let's get your first campaign published before your trial ends so you can see real results.",
          steps: [
            { label: 'Set up your brand profile', done: milestones.brandSetUp },
            { label: 'Add your first offer', done: milestones.offerAdded },
            { label: 'Connect your Meta ad account', done: milestones.metaConnected },
            { label: 'Publish your first campaign', done: milestones.adPublished },
          ],
          ctaText: milestones.adPublished ? 'View Your Dashboard →' : getNextActionCta(milestones),
          ctaUrl: milestones.adPublished ? 'https://adsbylumi.com/data' : getNextActionUrl(milestones),
          urgencyNote: '⏰ Your trial ends in 2 days',
        }),
      };
    case 7:
      return {
        subject: `Your trial ends today, ${firstName}`,
        html: buildTrialEmail(firstName, {
          headline: 'Your free trial ends today',
          subheadline: milestones.adPublished
            ? 'Your subscription starts automatically — no action needed!'
            : "Your subscription starts today. Make sure you're set up to get the most out of it.",
          body: milestones.adPublished
            ? "Great news — your ads are already running! Your paid subscription kicks in automatically today. Keep the momentum going."
            : "Your trial is over, but your subscription is starting. You can still finish setting up and get your ads live. If you'd like to cancel, you can do so from your account settings.",
          steps: [
            { label: 'Set up your brand profile', done: milestones.brandSetUp },
            { label: 'Add your first offer', done: milestones.offerAdded },
            { label: 'Connect your Meta ad account', done: milestones.metaConnected },
            { label: 'Publish your first campaign', done: milestones.adPublished },
          ],
          ctaText: milestones.adPublished ? 'View Results →' : 'Finish Setup →',
          ctaUrl: milestones.adPublished ? 'https://adsbylumi.com/data' : 'https://adsbylumi.com/dashboard',
          urgencyNote: null,
        }),
      };
    default:
      return { subject: '', html: '' };
  }
}

function getMilestoneNudge(m: Milestones): string {
  if (!m.brandSetUp) return "Your brand profile is the foundation of everything Lumi does. Let's start there — it only takes 2 minutes.";
  if (!m.offerAdded) return "You've got your brand set up — now let's add the offer you want to promote. Just drop in a URL and Lumi handles the rest.";
  if (!m.metaConnected) return "Your brand and offer are ready! Next step: connect your Meta ad account so Lumi can build and launch your campaigns.";
  if (!m.adPublished) return "Everything's connected — now it's time to publish your first campaign! Lumi will handle the setup in Meta.";
  return "You're all set! Your ads are running. Keep an eye on your dashboard for performance updates.";
}

function getNextActionCta(m: Milestones): string {
  if (!m.brandSetUp) return 'Complete Brand Profile →';
  if (!m.offerAdded) return 'Add Your Offer →';
  if (!m.metaConnected) return 'Connect Meta →';
  return 'Publish Your First Ad →';
}

function getNextActionUrl(m: Milestones): string {
  if (!m.brandSetUp) return 'https://adsbylumi.com/dashboard';
  if (!m.offerAdded) return 'https://adsbylumi.com/offers';
  if (!m.metaConnected) return 'https://adsbylumi.com/meta-settings';
  return 'https://adsbylumi.com/create';
}

interface TrialEmailConfig {
  headline: string;
  subheadline: string;
  body: string;
  steps: { label: string; done: boolean }[];
  ctaText: string;
  ctaUrl: string;
  urgencyNote: string | null;
}

function buildTrialEmail(firstName: string, config: TrialEmailConfig): string {
  const stepsHtml = config.steps
    .map(
      (s) => `
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <span style="margin-right: 10px; font-size: 16px;">${s.done ? '✅' : '⬜'}</span>
        <span style="color: ${s.done ? '#16a34a' : '#4a5568'}; font-size: 14px; line-height: 1.5; ${s.done ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${s.label}</span>
      </div>`
    )
    .join('');

  const urgencyHtml = config.urgencyNote
    ? `<div style="background: #FEF3C7; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; text-align: center;">
         <p style="margin: 0; color: #92400E; font-size: 13px; font-weight: 600;">${config.urgencyNote}</p>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 40px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">${config.headline}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px; font-weight: 500;">${config.subheadline}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 35px 40px 15px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName} 👋</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">${config.body}</p>
            </td>
          </tr>

          <!-- Urgency -->
          <tr>
            <td style="padding: 10px 40px;">
              ${urgencyHtml}
            </td>
          </tr>

          <!-- Checklist -->
          <tr>
            <td style="padding: 5px 40px 20px 40px;">
              <div style="background: #F9FAFB; border-radius: 12px; padding: 20px 22px; border: 1px solid #E5E7EB;">
                <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #111827;">Your setup progress:</p>
                ${stepsHtml}
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 5px 40px 35px 40px; text-align: center;">
              <a href="${config.ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                ${config.ctaText}
              </a>
            </td>
          </tr>

          <!-- Closer -->
          <tr>
            <td style="padding: 0 40px 35px 40px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.8;">
                Need help? Just open the chat inside the app — I'm always here.
              </p>
              <p style="margin: 16px 0 0 0; color: #111111; font-size: 15px; font-weight: 600;">
                You've got this 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                You're receiving this because you're on a free trial of Lumi.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
