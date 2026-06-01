import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { logEmail } from '../_shared/log-email.ts';
import { isInternalOrAuthenticated } from '../_shared/internal-auth.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard: only internal service-role callers (DB/auth hook) or an
  // authenticated user (self-triggered welcome) may invoke this endpoint.
  if (!(await isInternalOrAuthenticated(req))) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { email, fullName } = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    const firstName = fullName?.split(' ')[0] || 'there';
    const subject = `${firstName}, your ads era starts now ✨`;

    const { error: emailError } = await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: [email],
      subject,
      html: buildWelcomeEmailHtml(firstName),
    });

    if (emailError) {
      console.error('Welcome email send error:', emailError);
      await logEmail({
        recipient_email: email,
        recipient_name: fullName || null,
        email_type: 'welcome',
        subject,
        status: 'failed',
        error_message: emailError.message,
        edge_function: 'send-welcome-email',
      });
      throw new Error(emailError.message);
    }

    await logEmail({
      recipient_email: email,
      recipient_name: fullName || null,
      email_type: 'welcome',
      subject,
      status: 'sent',
      edge_function: 'send-welcome-email',
    });

    console.log(`Welcome email sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending welcome email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildWelcomeEmailHtml(firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Lumi</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 45px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">Welcome to Lumi ✨</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px; font-weight: 500;">Your Meta Ads co-pilot just clocked in.</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName} 👋</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                I'm so glad you're here.
              </p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                Lumi is your AI-powered strategist for Meta Ads — I'll help you plan campaigns, write scroll-stopping copy, build your ads, and optimize performance. No Ads Manager headaches. No guesswork.
              </p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                Think of me as the marketing bestie who actually knows what she's doing. 💅
              </p>
            </td>
          </tr>

          <!-- Steps Section -->
          <tr>
            <td style="padding: 10px 40px 30px 40px;">
              <p style="margin: 0 0 20px 0; color: #111111; font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">Here's how we get you running:</p>
              
              <!-- Step 1 -->
              <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; border-left: 4px solid #F97316;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong style="color: #C2410C;">✦ Set up your brand</strong><br/>
                  <span style="color: #9A3412;">Tell me about your business, voice, and dream client — I'll remember everything so your ads always sound like <em>you</em>.</span>
                </p>
              </div>

              <!-- Step 2 -->
              <div style="background: linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%); border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; border-left: 4px solid #EC4899;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong style="color: #9D174D;">✦ Add your first offer</strong><br/>
                  <span style="color: #831843;">Drop in your landing page URL and I'll extract the details, psychology, and messaging angles automatically.</span>
                </p>
              </div>

              <!-- Step 3 -->
              <div style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; border-left: 4px solid #A78BFA;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong style="color: #5B21B6;">✦ Connect Meta</strong><br/>
                  <span style="color: #4C1D95;">Link your ad account so I can build, launch, and manage campaigns for you — right from the dashboard.</span>
                </p>
              </div>

              <!-- Step 4 -->
              <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 18px 20px; border-left: 4px solid #93C5FD;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong style="color: #1E40AF;">✦ Launch your first campaign</strong><br/>
                  <span style="color: #1E3A8A;">I'll handle the strategy, copy, and creative direction. You just hit publish and watch the magic happen.</span>
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 5px 40px 35px 40px; text-align: center;">
              <a href="https://adsbylumi.com/start" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                Let's Get Started →
              </a>
            </td>
          </tr>

          <!-- Warm closer -->
          <tr>
            <td style="padding: 0 40px 35px 40px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.8;">
                I'm here whenever you need me — just open the chat inside the app. No question is too small, no campaign too messy. We've got this.
              </p>
              <p style="margin: 16px 0 0 0; color: #111111; font-size: 15px; font-weight: 600;">
                Let's make your ads unforgettable 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                You're receiving this because you just created an account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
