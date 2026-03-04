import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, tierName, periodEnd } = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    const firstName = fullName?.split(' ')[0] || 'there';
    const endDate = periodEnd
      ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'the end of your billing period';

    const { error: emailError } = await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: [email],
      subject: `We'll miss you, ${firstName} 💜`,
      html: buildCancellationEmailHtml(firstName, tierName || 'your plan', endDate),
    });

    if (emailError) {
      console.error('Cancellation email send error:', emailError);
      throw new Error(emailError.message);
    }

    console.log(`Cancellation email sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending cancellation email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildCancellationEmailHtml(firstName: string, tierName: string, endDate: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We'll miss you</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #A78BFA 0%, #EC4899 50%, #F97316 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">We'll miss you 💜</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName},</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8;">
                I wanted to personally let you know that your cancellation has been confirmed. No hard feelings — I get it.
              </p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8;">
                Your ${tierName} access will remain active until <strong style="color: #111111;">${endDate}</strong>. Everything you've built — your brand setup, audience psychology, creative assets, and campaign data — will be waiting for you if you ever decide to come back.
              </p>
            </td>
          </tr>

          <!-- What you still have access to -->
          <tr>
            <td style="padding: 10px 40px 25px 40px;">
              <div style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 22px; border-left: 4px solid #A78BFA;">
                <p style="margin: 0; color: #5B21B6; font-size: 15px; font-weight: 700;">Until ${endDate}, you still have:</p>
                <p style="margin: 12px 0 0 0; color: #6D28D9; font-size: 14px; line-height: 1.8;">
                  ✦ Full access to your dashboard<br/>
                  ✦ All your campaign data and creative assets<br/>
                  ✦ Lumi chat for strategy help<br/>
                  ✦ Performance reports and insights
                </p>
              </div>
            </td>
          </tr>

          <!-- Feedback request -->
          <tr>
            <td style="padding: 0 40px 25px 40px;">
              <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-radius: 12px; padding: 22px; border-left: 4px solid #F97316;">
                <p style="margin: 0; color: #C2410C; font-size: 14px; font-weight: 700;">💡 Quick favor?</p>
                <p style="margin: 10px 0 0 0; color: #9A3412; font-size: 14px; line-height: 1.7;">
                  If there's anything I could have done better — or a feature you wished existed — I'd love to hear it. Just reply to this email. Every piece of feedback makes Lumi better for everyone.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA to reactivate -->
          <tr>
            <td style="padding: 5px 40px 15px 40px; text-align: center;">
              <p style="margin: 0 0 16px 0; color: #4a5568; font-size: 14px;">Changed your mind? You can reactivate anytime.</p>
              <a href="https://adsbylumi.com/settings" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                Reactivate My Plan →
              </a>
            </td>
          </tr>

          <!-- Warm closer -->
          <tr>
            <td style="padding: 20px 40px 35px 40px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.8;">
                Whatever you're working on next, I'm rooting for you. And if you ever need a hand with your ads again — I'll be right here.
              </p>
              <p style="margin: 16px 0 0 0; color: #111111; font-size: 15px; font-weight: 600;">
                Wishing you all the best 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                You're receiving this because your subscription was cancelled.
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
