import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { logEmail } from '../_shared/log-email.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, referralLink, referralCode, rewardfulAffiliateId, customMessage, partnerTrialCode } = await req.json();

    if (!email || !firstName || !referralLink) {
      return new Response(
        JSON.stringify({ error: true, message: 'email, firstName, and referralLink are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create or get access token, store trial code
    const { data: existingToken } = await supabase
      .from('partner_access_tokens')
      .select('token')
      .eq('email', email)
      .maybeSingle();

    let accessToken: string;
    if (existingToken?.token) {
      accessToken = existingToken.token;
      // Update trial code on existing token
      if (partnerTrialCode) {
        await supabase
          .from('partner_access_tokens')
          .update({ partner_trial_code: partnerTrialCode })
          .eq('email', email);
      }
    } else {
      const { data: newToken, error: tokenError } = await supabase
        .from('partner_access_tokens')
        .insert({
          email,
          rewardful_affiliate_id: rewardfulAffiliateId || null,
          partner_trial_code: partnerTrialCode || null,
        })
        .select('token')
        .single();
      if (tokenError) throw tokenError;
      accessToken = newToken.token;
    }

    const dashboardUrl = `https://adsbylumi.com/partner-dashboard?token=${accessToken}`;

    // Send branded approval email
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    await resend.emails.send({
      from: 'LUMI Partners <hello@adsbylumi.com>',
      to: [email],
      subject: `You're in! Welcome to the LUMI Partner Program, ${firstName} ✨`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #FAF9F6; font-family: 'Red Hat Display', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
          
          <!-- Header Gradient Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #F97316, #EC4899, #A78BFA, #93C5FD);"></td>
          </tr>
          
          <!-- Logo + Badge -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="https://adsbylumi.com/lovable-uploads/your-ad-assistant-logo.png" alt="LUMI" height="32" style="display: block;" />
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #ffffff; background: linear-gradient(135deg, #F97316, #EC4899); letter-spacing: 0.5px;">PARTNER</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Welcome Message -->
          <tr>
            <td style="padding: 16px 40px 0;">
               <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 800; color: #111111; line-height: 1.3;">
                 Welcome to the team, ${firstName}! 🎉
               </h1>
               ${customMessage ? `
               <div style="margin: 0 0 20px; padding: 16px 20px; background-color: #FFF7ED; border-radius: 10px; border-left: 4px solid #F97316;">
                 <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.7; font-style: italic;">
                   "${customMessage}"
                 </p>
                 <p style="margin: 8px 0 0; font-size: 12px; color: #999999;">— The LUMI Team</p>
               </div>
               ` : ''}
                <p style="margin: 0 0 24px; font-size: 15px; color: #555555; line-height: 1.7;">
                  Your application to the LUMI Partner Program has been approved. You now earn <strong style="color: #111111;">30% recurring monthly commission</strong> on every subscription you refer — for as long as they stay subscribed.
                </p>
              </p>
            </td>
          </tr>

          <!-- Partner Trial Code Card -->
          ${partnerTrialCode ? `
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ECFDF5, #F0FDF4); border-radius: 12px; border: 2px solid #86EFAC;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #16A34A; text-transform: uppercase; letter-spacing: 1px;">🎁 Your Partner Trial Code</p>
                    <p style="margin: 0 0 8px; font-size: 28px; font-weight: 800; color: #111111; letter-spacing: 2px;">${partnerTrialCode}</p>
                    <p style="margin: 0; font-size: 13px; color: #555555; line-height: 1.6;">
                      Share this code with your audience. When they enter it at checkout, they get a <strong style="color: #111111;">14-day free trial</strong> of LUMI — and you earn commission when they convert to a paid subscription.
                    </p>
                    <p style="margin: 12px 0 0; font-size: 12px; color: #888888;">
                      Direct link: <a href="https://adsbylumi.com/?code=${partnerTrialCode}" style="color: #F97316; text-decoration: none; font-weight: 600;">adsbylumi.com/?code=${partnerTrialCode}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- Referral Link Card -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #FFF7ED, #FDF2F8); border-radius: 12px; border: 1px solid #FECDD3;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #F97316; text-transform: uppercase; letter-spacing: 1px;">Your Referral Link</p>
                    <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111111; word-break: break-all;">${referralLink}</p>
                    ${referralCode ? `<p style="margin: 8px 0 0; font-size: 13px; color: #666666;">Code: <strong style="color: #111111;">${referralCode}</strong></p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
           <!-- Dashboard CTA -->
          <tr>
            <td style="padding: 0 40px 32px;" align="center">
              <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 40px; border-radius: 10px; font-size: 15px; font-weight: 700; color: #ffffff; background: linear-gradient(135deg, #F97316, #EC4899); text-decoration: none; letter-spacing: 0.3px;">
                Open Your Partner Dashboard →
              </a>
              <p style="margin: 12px 0 0; font-size: 12px; color: #999999;">
                Bookmark this link — it's your personal dashboard
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #F0EDE8; margin: 0;" />
            </td>
          </tr>

          <!-- Book a Setup Call -->
          <tr>
            <td style="padding: 32px 40px 8px;">
              <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 800; color: #111111;">
                📞 Let's Get You Set Up for Success
              </h2>
              <p style="margin: 0 0 16px; font-size: 14px; color: #555555; line-height: 1.6;">
                Book a 1:1 onboarding call with us so we can walk you through everything, answer your questions, and make sure you're set up to earn from day one.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px;" align="center">
              <a href="https://calendar.app.google/2XAStgsuYje8npVo8" style="display: inline-block; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 700; color: #ffffff; background: linear-gradient(135deg, #A78BFA, #6366F1); text-decoration: none; letter-spacing: 0.3px;">
                Book Your Partner Setup Call →
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #F0EDE8; margin: 0;" />
            </td>
          </tr>

          <!-- Speaking / Education Offer -->
          <tr>
            <td style="padding: 32px 40px 8px;">
              <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 800; color: #111111;">
                🎤 We'll Come Speak to Your Community
              </h2>
              <p style="margin: 0 0 16px; font-size: 14px; color: #555555; line-height: 1.6;">
                Want to offer your audience a masterclass on Meta ads? We'll come speak in your community — whether it's a group coaching call, a membership training, a podcast, or a live event. We'll cover how to run ads that actually convert, and show how LUMI makes the whole process simple.
              </p>
              <p style="margin: 0 0 16px; font-size: 14px; color: #555555; line-height: 1.6;">
                It's a win-win: your audience gets expert ads education, and you earn commission on every signup. Just mention it on your setup call or reply to this email to schedule.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #F0EDE8; margin: 0;" />
            </td>
          </tr>
          
          <!-- Marketing Assets Section -->
          <tr>
            <td style="padding: 32px 40px 8px;">
              <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 800; color: #111111;">
                📦 Your Marketing Kit
              </h2>
              <p style="margin: 0 0 20px; font-size: 14px; color: #555555; line-height: 1.6;">
                Copy-paste ready content to start sharing LUMI with your audience today. Edit these to match your voice!
              </p>
            </td>
          </tr>
          
          <!-- Copy Blocks -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <!-- Social Post -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px; background-color: #FAFAF8; border-radius: 10px; border: 1px solid #F0EDE8;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; color: #F97316; text-transform: uppercase; letter-spacing: 1px;">📱 Social Post</p>
                    <p style="margin: 0; font-size: 13px; color: #444444; line-height: 1.6;">
                      I've been recommending LUMI to my audience and they love it. It builds your entire Meta ad campaign — strategy, copy, creative briefs, everything — in minutes. Perfect for coaches & course creators. Try it here: ${referralLink}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Email Copy -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px; background-color: #FAFAF8; border-radius: 10px; border: 1px solid #F0EDE8;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; color: #A78BFA; text-transform: uppercase; letter-spacing: 1px;">✉️ Email / Newsletter</p>
                    <p style="margin: 0; font-size: 13px; color: #444444; line-height: 1.6;">
                      Quick recommendation: There's a tool called LUMI that acts as your own ads manager. You plug in your offer, and it builds your entire Meta ad campaign — angles, copy, creative briefs, everything. I've seen great results from my audience. Check it out here: ${referralLink}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- DM Copy -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px; background-color: #FAFAF8; border-radius: 10px; border: 1px solid #F0EDE8;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; color: #EC4899; text-transform: uppercase; letter-spacing: 1px;">💬 DM / Story</p>
                    <p style="margin: 0; font-size: 13px; color: #444444; line-height: 1.6;">
                      Have you tried LUMI for your ads? It's a game-changer for coaches & course creators — here's my link: ${referralLink}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Story / Reel Script -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAFAF8; border-radius: 10px; border: 1px solid #F0EDE8;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; color: #93C5FD; text-transform: uppercase; letter-spacing: 1px;">🎬 Story / Reel Script</p>
                    <p style="margin: 0; font-size: 13px; color: #444444; line-height: 1.6;">
                      "If you've been wanting to run Meta ads but have no idea where to start — let me introduce you to LUMI. It literally builds your entire ad campaign for you. Strategy, copy, creative briefs, everything. I use it and my audience loves it. Link in bio!"
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Brand Assets -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <p style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #111111;">🎨 Brand Assets & Logos</p>
              <p style="margin: 0 0 16px; font-size: 13px; color: #555555; line-height: 1.6;">
                Download LUMI logos, partner badges, and branded graphics from your dashboard to use in your content and promotions.
              </p>
              <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #F97316; border: 2px solid #F97316; text-decoration: none;">
                Download Assets →
              </a>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #F0EDE8; margin: 0;" />
            </td>
          </tr>
          
          <!-- How It Works -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 800; color: #111111;">
                How it works
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                    <strong style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: linear-gradient(135deg, #F97316, #EC4899); color: white; font-size: 12px; margin-right: 12px; vertical-align: middle;">1</strong>
                    Book your setup call & get your link ready
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                    <strong style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: linear-gradient(135deg, #F97316, #EC4899); color: white; font-size: 12px; margin-right: 12px; vertical-align: middle;">2</strong>
                    Share with your audience using the marketing kit above
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                    <strong style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: linear-gradient(135deg, #F97316, #EC4899); color: white; font-size: 12px; margin-right: 12px; vertical-align: middle;">3</strong>
                    You earn 30% of their subscription — every month
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #FAFAF8; border-top: 1px solid #F0EDE8;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 13px; color: #999999;">
                      Questions? Reply to this email or reach out to
                      <a href="mailto:hello@adsbylumi.com" style="color: #F97316; text-decoration: none;">hello@adsbylumi.com</a>
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #CCCCCC;">
                      © ${new Date().getFullYear()} LUMI by After Organic · adsbylumi.com
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    await logEmail({
      recipient_email: email,
      recipient_name: `${firstName} ${lastName || ''}`.trim(),
      email_type: 'partner_approval',
      subject: `You're in! Welcome to the LUMI Partner Program, ${firstName} ✨`,
      status: 'sent',
      edge_function: 'send-partner-approval',
      metadata: { referral_link: referralLink, referral_code: referralCode },
    });

    return new Response(
      JSON.stringify({ success: true, dashboardUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('send-partner-approval error:', error);
    return new Response(
      JSON.stringify({ error: true, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
