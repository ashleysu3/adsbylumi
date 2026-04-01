import { Resend } from 'npm:resend@2.0.0';
import Stripe from 'https://esm.sh/stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { logEmail } from '../_shared/log-email.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Drip schedule: step -> days after signup
const DRIP_SCHEDULE: Record<number, number> = {
  1: 1,  // Day 1: Complete brand profile
  2: 3,  // Day 3: Add first offer
  3: 5,  // Day 5: Create first ad
  4: 7,  // Day 7: Connect Meta
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users who haven't completed the drip sequence (step < 4)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at, onboarding_email_step')
      .lt('onboarding_email_step', 4)
      .eq('archived', false);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw new Error(usersError.message);
    }

    if (!users || users.length === 0) {
      console.log('No users need onboarding emails');
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;

    for (const user of users) {
      try {
        // Skip users who are on a Stripe trial — they get trial-specific emails instead
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2025-08-27.basil' });
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({
            customer: customers.data[0].id,
            status: 'trialing',
            limit: 1,
          });
          if (subs.data.length > 0) {
            console.log(`Skipping trial user ${user.email} — handled by trial reminders`);
            continue;
          }
        }

        const nextStep = user.onboarding_email_step + 1;
        const daysRequired = DRIP_SCHEDULE[nextStep];

        if (!daysRequired) continue;

        // Check if enough days have passed since signup
        const signupDate = new Date(user.created_at);
        const now = new Date();
        const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceSignup < daysRequired) continue;

        // Check user's actual state to decide whether to send or skip
        const shouldSend = await checkShouldSend(supabase, user.id, nextStep);

        if (!shouldSend.send) {
          // User already completed this milestone — advance step and check next
          await supabase
            .from('profiles')
            .update({ onboarding_email_step: nextStep })
            .eq('id', user.id);
          console.log(`User ${user.email} already completed step ${nextStep}, advancing`);
          continue;
        }

        const firstName = user.full_name?.split(' ')[0] || 'there';
        const emailContent = getEmailForStep(nextStep, firstName);

        const { error: emailError } = await resend.emails.send({
          from: 'Lumi <hello@adsbylumi.com>',
          to: [user.email],
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (emailError) {
          console.error(`Failed to send step ${nextStep} email to ${user.email}:`, emailError);
          await logEmail({
            recipient_email: user.email,
            recipient_name: user.full_name || null,
            email_type: 'onboarding_drip',
            subject: emailContent.subject,
            status: 'failed',
            error_message: emailError.message,
            edge_function: 'send-onboarding-drip',
            metadata: { step: nextStep },
          });
          continue;
        }

        await logEmail({
          recipient_email: user.email,
          recipient_name: user.full_name || null,
          email_type: 'onboarding_drip',
          subject: emailContent.subject,
          status: 'sent',
          edge_function: 'send-onboarding-drip',
          metadata: { step: nextStep },
        });

        // Update the step
        await supabase
          .from('profiles')
          .update({ onboarding_email_step: nextStep })
          .eq('id', user.id);

        console.log(`Sent step ${nextStep} email to ${user.email}`);
        sentCount++;
      } catch (userErr) {
        console.error(`Error processing user ${user.email}:`, userErr);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, checked: users.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in onboarding drip:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkShouldSend(supabase: any, userId: string, step: number): Promise<{ send: boolean }> {
  // Get user's brand
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, website_url, industry, value_proposition, target_audience, psychology_status, meta_account_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  switch (step) {
    case 1: {
      // Step 1: Complete brand profile
      const isComplete = brand && brand.name && brand.website_url && brand.industry && brand.value_proposition;
      return { send: !isComplete };
    }
    case 2: {
      // Step 2: Add first offer
      if (!brand) return { send: true };
      const { count } = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brand.id)
        .eq('archived', false);
      return { send: (count || 0) === 0 };
    }
    case 3: {
      // Step 3: Create first ad
      if (!brand) return { send: true };
      const { count } = await supabase
        .from('campaign_workspaces')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brand.id)
        .eq('archived', false);
      return { send: (count || 0) === 0 };
    }
    case 4: {
      // Step 4: Connect Meta
      return { send: !brand?.meta_account_id };
    }
    default:
      return { send: false };
  }
}

function getEmailForStep(step: number, firstName: string): { subject: string; html: string } {
  switch (step) {
    case 1:
      return {
        subject: `${firstName}, let's finish setting up your brand 🎨`,
        html: buildDripEmail(firstName, {
          emoji: '🎨',
          headline: "Your brand profile is waiting",
          subheadline: "A quick setup unlocks smarter ads.",
          body: `The more Lumi knows about your brand, the better your ad copy, creative direction, and strategy will be. It only takes about 2 minutes to fill in the essentials.`,
          tipTitle: "What to add:",
          tips: [
            "Your website URL (Lumi will auto-extract your brand details)",
            "Your industry and value proposition",
            "Who your ideal client is",
          ],
          ctaText: "Complete My Brand Profile →",
          ctaUrl: "https://adsbylumi.com/dashboard",
          accentColor: "#F97316",
          gradientFrom: "#FFF7ED",
          gradientTo: "#FFEDD5",
          tipBorderColor: "#F97316",
          tipTextColor: "#C2410C",
          tipBodyColor: "#9A3412",
        }),
      };
    case 2:
      return {
        subject: `${firstName}, your first offer is just one URL away 🎯`,
        html: buildDripEmail(firstName, {
          emoji: '🎯',
          headline: "Time to add what you're promoting",
          subheadline: "This is how Lumi knows what to sell.",
          body: `Drop in the URL of your landing page, course, or service — Lumi will automatically extract the details, pricing, and psychology angles. No typing required.`,
          tipTitle: "What Lumi does with your offer:",
          tips: [
            "Extracts your offer description and pricing automatically",
            "Builds audience psychology specific to that product",
            "Generates messaging angles that actually convert",
          ],
          ctaText: "Add My First Offer →",
          ctaUrl: "https://adsbylumi.com/dashboard",
          accentColor: "#EC4899",
          gradientFrom: "#FDF2F8",
          gradientTo: "#FCE7F3",
          tipBorderColor: "#EC4899",
          tipTextColor: "#9D174D",
          tipBodyColor: "#831843",
        }),
      };
    case 3:
      return {
        subject: `${firstName}, ready to create your first ad? ✨`,
        html: buildDripEmail(firstName, {
          emoji: '✨',
          headline: "Let's create your first campaign",
          subheadline: "Lumi handles the hard parts.",
          body: `You've got your brand and offer set up — now it's time for the fun part. Lumi will generate psychology-backed creative angles, talking-head scripts, ad copy, and a full campaign strategy. All you have to do is pick what you love.`,
          tipTitle: "What you'll get:",
          tips: [
            "Multiple creative angles tailored to your audience's psychology",
            "Talking-head scripts you can film on your phone",
            "Headlines, descriptions, and primary copy — ready to use",
            "A production checklist so you never miss a step",
          ],
          ctaText: "Create My First Ad →",
          ctaUrl: "https://adsbylumi.com/create",
          accentColor: "#A78BFA",
          gradientFrom: "#F5F3FF",
          gradientTo: "#EDE9FE",
          tipBorderColor: "#A78BFA",
          tipTextColor: "#5B21B6",
          tipBodyColor: "#4C1D95",
        }),
      };
    case 4:
      return {
        subject: `${firstName}, one last step to go live 🚀`,
        html: buildDripEmail(firstName, {
          emoji: '🚀',
          headline: "Connect Meta and go live",
          subheadline: "This is the part where it gets real.",
          body: `Connecting your Meta ad account lets Lumi build, launch, and optimize your campaigns — all from inside the dashboard. No more fumbling through Ads Manager. No more guessing what to click.`,
          tipTitle: "What connecting unlocks:",
          tips: [
            "One-click campaign publishing straight to Meta",
            "Automatic performance tracking and weekly reports",
            "Smart recommendations when ads need refreshing",
            "Lumi manages the technical setup — you just approve",
          ],
          ctaText: "Connect My Ad Account →",
          ctaUrl: "https://adsbylumi.com/dashboard",
          accentColor: "#3B82F6",
          gradientFrom: "#EFF6FF",
          gradientTo: "#DBEAFE",
          tipBorderColor: "#3B82F6",
          tipTextColor: "#1E40AF",
          tipBodyColor: "#1E3A8A",
        }),
      };
    default:
      return { subject: '', html: '' };
  }
}

interface DripEmailConfig {
  emoji: string;
  headline: string;
  subheadline: string;
  body: string;
  tipTitle: string;
  tips: string[];
  ctaText: string;
  ctaUrl: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  tipBorderColor: string;
  tipTextColor: string;
  tipBodyColor: string;
}

function buildDripEmail(firstName: string, config: DripEmailConfig): string {
  const tipsHtml = config.tips
    .map(
      (tip) => `
      <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
        <span style="color: ${config.accentColor}; margin-right: 8px; font-weight: 700; flex-shrink: 0;">✦</span>
        <span style="color: ${config.tipBodyColor}; font-size: 14px; line-height: 1.6;">${tip}</span>
      </div>`
    )
    .join('');

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
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">${config.headline} ${config.emoji}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px; font-weight: 500;">${config.subheadline}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 35px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName} 👋</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                ${config.body}
              </p>
            </td>
          </tr>

          <!-- Tips -->
          <tr>
            <td style="padding: 10px 40px 25px 40px;">
              <div style="background: linear-gradient(135deg, ${config.gradientFrom} 0%, ${config.gradientTo} 100%); border-radius: 12px; padding: 20px 22px; border-left: 4px solid ${config.tipBorderColor};">
                <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: ${config.tipTextColor};">${config.tipTitle}</p>
                ${tipsHtml}
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
                You're receiving this because you recently signed up for Lumi.
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
