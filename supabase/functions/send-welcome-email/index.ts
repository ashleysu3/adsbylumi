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
    const { email, fullName } = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    const firstName = fullName?.split(' ')[0] || 'there';

    const { error: emailError } = await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: [email],
      subject: `Welcome to Lumi, ${firstName}! ✨`,
      html: buildWelcomeEmailHtml(firstName),
    });

    if (emailError) {
      console.error('Welcome email send error:', emailError);
      throw new Error(emailError.message);
    }

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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #1a1a2e 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Welcome to Lumi ✨</h1>
              <p style="color: #c4b5fd; margin: 12px 0 0 0; font-size: 16px;">Your Meta Ads co-pilot is ready.</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 35px 30px 20px 30px;">
              <p style="margin: 0; color: #2d3748; font-size: 17px; line-height: 1.6;">Hi ${firstName},</p>
              <p style="margin: 14px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.7;">
                Welcome aboard! I'm Lumi — your AI-powered Meta Ads strategist. I'm here to help you plan, create, launch, and optimize your ad campaigns without the overwhelm.
              </p>
            </td>
          </tr>

          <!-- Steps -->
          <tr>
            <td style="padding: 10px 30px 25px 30px;">
              <p style="margin: 0 0 15px 0; color: #2d3748; font-size: 16px; font-weight: 600;">Here's how to get started:</p>
              
              <div style="background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; padding: 15px; margin-bottom: 12px;">
                <p style="margin: 0; color: #166534; font-size: 14px;">
                  <strong>1. Set up your brand</strong><br/>
                  Tell me about your business, voice, and audience — I'll remember everything.
                </p>
              </div>

              <div style="background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 15px; margin-bottom: 12px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  <strong>2. Add your first offer</strong><br/>
                  Drop in your landing page URL and I'll extract the details automatically.
                </p>
              </div>

              <div style="background: #fdf4ff; border-left: 4px solid #a855f7; border-radius: 0 8px 8px 0; padding: 15px; margin-bottom: 12px;">
                <p style="margin: 0; color: #6b21a8; font-size: 14px;">
                  <strong>3. Connect Meta</strong><br/>
                  Link your ad account so I can build and manage campaigns for you.
                </p>
              </div>

              <div style="background: #fff7ed; border-left: 4px solid #f97316; border-radius: 0 8px 8px 0; padding: 15px;">
                <p style="margin: 0; color: #9a3412; font-size: 14px;">
                  <strong>4. Launch your first campaign</strong><br/>
                  I'll handle the strategy, copy, and creative direction. You just hit publish.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 5px 30px 30px 30px; text-align: center;">
              <a href="https://adsbylumi.com/start" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #d946ef 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                Get Started →
              </a>
            </td>
          </tr>

          <!-- Warm closer -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.7;">
                I'm here whenever you need me — just open the chat inside the app. No question is too small.
              </p>
              <p style="margin: 14px 0 0 0; color: #4a5568; font-size: 14px;">
                Let's make your ads work harder 💜<br/>
                <strong>— Lumi</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f7fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px;">
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
