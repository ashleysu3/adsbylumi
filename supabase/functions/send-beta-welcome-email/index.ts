import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { logEmail } from '../_shared/log-email.ts';

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
      subject: `Welcome to Lumi, ${firstName} — You're a Founding Member ✨`,
      html: buildBetaWelcomeHtml(firstName),
    });

    if (emailError) {
      console.error('Beta welcome email send error:', emailError);
      throw new Error(emailError.message);
    }

    await logEmail({
      recipient_email: email,
      recipient_name: fullName || null,
      email_type: 'beta_welcome',
      subject: `Welcome to Lumi, ${firstName} — You're a Founding Member ✨`,
      status: 'sent',
      edge_function: 'send-beta-welcome-email',
    });

    console.log(`Beta welcome email sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending beta welcome email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildBetaWelcomeHtml(firstName: string): string {
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
              <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">You're a Lumi Founding Member ✨</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px; font-weight: 500;">You're literally helping shape the future of this platform.</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName} 👋</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                First — thank you. Seriously. You're one of the very first people using Lumi, and we are <em>thrilled</em> to have you here from the beginning.
              </p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                As a founding member, you're helping shape what Lumi becomes. Every feature you use, every idea you share, every "hmm, this could be better" moment — that's gold for us. We genuinely want to hear your feature requests, your feedback, all of it.
              </p>
            </td>
          </tr>

          <!-- What beta means -->
          <tr>
            <td style="padding: 10px 40px 20px 40px;">
              <p style="margin: 0 0 16px 0; color: #111111; font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">What being a founding member means:</p>
              
              <div style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 20px; margin-bottom: 14px; border-left: 4px solid #A78BFA;">
                <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #4C1D95;">
                  <strong>🔮 You're an early insider</strong> — You'll see features before anyone else and your feedback directly influences what we build next.
                </p>
              </div>

              <div style="background: linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%); border-radius: 12px; padding: 20px; margin-bottom: 14px; border-left: 4px solid #EC4899;">
                <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #831843;">
                  <strong>🐛 There might be bugs</strong> — That's expected! Things may break or feel a little rough around the edges. That's what this phase is for.
                </p>
              </div>

              <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-radius: 12px; padding: 20px; border-left: 4px solid #F97316;">
                <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #9A3412;">
                  <strong>💬 Your voice matters</strong> — We genuinely want to hear what's working, what's confusing, and what's missing. Don't hold back.
                </p>
              </div>

              <!-- 1:1 Campaign Build Call -->
              <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 22px 20px; margin-top: 20px; border-left: 4px solid #93C5FD;">
                <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: 700; color: #1E40AF;">One more thing — I'm doing something special for the first 25 people. 👇</p>
                <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.7; color: #1E3A8A;">
                  I'm personally offering <strong>25 free 15-minute campaign build calls</strong>. You book a time, we hop on Zoom, and I help you build your first LUMI campaign live together. You walk away with a real, ready-to-launch campaign — not a plan, not homework, an actual campaign.
                </p>
                <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.7; color: #1E3A8A;">
                  This is a call with me. The person who built LUMI, ran the agency, and has seen firsthand what makes these campaigns fly (and what makes them flop). First come, first served, and I genuinely mean it when I say these will go fast.
                </p>
                <p style="margin: 0; text-align: center;">
                  <a href="https://calendar.app.google/2XAStgsuYje8npVo8" style="display: inline-block; background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 4px 14px rgba(30, 64, 175, 0.3);">
                    Book your free campaign build call → 25 spots only
                  </a>
                </p>
              </div>
            </td>
          </tr>

          <!-- How to report bugs -->
          <tr>
            <td style="padding: 10px 40px 25px 40px;">
              <p style="margin: 0 0 16px 0; color: #111111; font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">How to report bugs or share feedback:</p>
              
              <div style="background: #F9FAFB; border-radius: 12px; padding: 20px; border: 1px solid #E5E7EB;">
                <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.7; color: #374151;">
                  <strong>🐞 The ladybug button</strong> — Look for the little ladybug icon in the bottom-right corner of the app. Tap it anytime to report a bug or share a thought. It captures your screen context automatically so we can fix things faster.
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #374151;">
                  <strong>📧 Email us</strong> — You can also reach us anytime at <a href="mailto:support@adsbylumi.com" style="color: #A78BFA; font-weight: 600; text-decoration: none;">support@adsbylumi.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 5px 40px 35px 40px; text-align: center;">
              <a href="https://adsbylumi.com/start" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                Start Exploring Lumi →
              </a>
            </td>
          </tr>

          <!-- Warm closer -->
          <tr>
            <td style="padding: 0 40px 35px 40px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.8;">
                I'll check in with you in about a week to hear how things are going. In the meantime — explore, experiment, and don't be shy about telling me what you think.
              </p>
              <p style="margin: 16px 0 0 0; color: #111111; font-size: 15px; font-weight: 600;">
                So grateful to have you here 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                You're receiving this because you signed up with a beta invite code.
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
