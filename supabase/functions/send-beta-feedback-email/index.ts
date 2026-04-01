import { Resend } from 'npm:resend@2.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
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
      subject: `${firstName}, how's your first week with Lumi? 💭`,
      html: buildBetaFeedbackHtml(firstName),
    });

    if (emailError) {
      console.error('Beta feedback email send error:', emailError);
      throw new Error(emailError.message);
    }

    console.log(`Beta feedback email sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending beta feedback email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function buildBetaFeedbackHtml(firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your First Week with Lumi</title>
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
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 45px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">It's Been a Week! 🎉</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px; font-weight: 500;">Time for a quick check-in.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName} 👋</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                You've had a full week with Lumi — and I'd love to hear how it's going! Your honest feedback helps me build something truly amazing for coaches, creators, and service pros like you.
              </p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                I have just <strong>4 quick questions</strong> — takes about 2 minutes. Your answers go straight to our team. 💜
              </p>
            </td>
          </tr>

          <!-- Questions Preview -->
          <tr>
            <td style="padding: 10px 40px 25px 40px;">
              <div style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 24px; border-left: 4px solid #A78BFA;">
                <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.7; color: #4C1D95;">
                  <strong>1.</strong> What's been your favorite feature so far?
                </p>
                <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.7; color: #4C1D95;">
                  <strong>2.</strong> What felt confusing or hard to find?
                </p>
                <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.7; color: #4C1D95;">
                  <strong>3.</strong> What feature do you wish Lumi had?
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #4C1D95;">
                  <strong>4.</strong> On a scale of 1–10, how likely are you to recommend Lumi?
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 5px 40px 35px 40px; text-align: center;">
              <a href="https://adsbylumi.com/beta-feedback" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                Share My Feedback →
              </a>
            </td>
          </tr>

          <!-- Closer -->
          <tr>
            <td style="padding: 0 40px 35px 40px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.8;">
                Even one sentence helps. And if you'd rather just reply to this email with your thoughts — that works too. No wrong way to do this.
              </p>
              <p style="margin: 16px 0 0 0; color: #111111; font-size: 15px; font-weight: 600;">
                Thank you for being part of this 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                You're receiving this because you're a founding member.
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
