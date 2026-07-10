import { Resend } from 'npm:resend@2.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
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

  // Anonymous ad-first sessions are real Supabase Auth users (is_anonymous
  // = true) with a real JWT, so they pass this same guard as any other
  // authenticated caller.
  if (!(await isInternalOrAuthenticated(req))) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { brand_id } = await req.json();
    if (!brand_id) throw new Error('brand_id is required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('name, lead_email, lead_name, ad_pack_image_url')
      .eq('id', brand_id)
      .maybeSingle();
    if (brandErr) throw brandErr;
    if (!brand) throw new Error('Brand not found');
    if (!brand.lead_email) throw new Error('No lead email captured for this brand yet');
    if (!brand.ad_pack_image_url) throw new Error('No ad pack image stored for this brand yet');

    const firstName = (brand.lead_name || '').trim().split(' ')[0] || 'there';
    const subject = `${firstName}, your ad is ready 🎉`;

    const { error: emailError } = await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: [brand.lead_email],
      subject,
      html: buildAdPackEmailHtml(firstName, brand.name || 'your brand', brand.ad_pack_image_url),
    });

    if (emailError) {
      console.error('Ad pack email send error:', emailError);
      await logEmail({
        recipient_email: brand.lead_email,
        recipient_name: brand.lead_name || null,
        email_type: 'ad_pack',
        subject,
        status: 'failed',
        error_message: emailError.message,
        edge_function: 'send-ad-pack-email',
      });
      throw new Error(emailError.message);
    }

    await logEmail({
      recipient_email: brand.lead_email,
      recipient_name: brand.lead_name || null,
      email_type: 'ad_pack',
      subject,
      status: 'sent',
      edge_function: 'send-ad-pack-email',
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending ad pack email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// NOTE: the CTA below points at /join (the 50%-off signup page) for now.
// Once the VSL page ships, this should point there instead so the
// email -> VSL -> discounted-signup flow described in the funnel spec is
// actually connected end to end — tracked as a known follow-up, not
// forgotten.
function buildAdPackEmailHtml(firstName: string, brandName: string, imageUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your LUMI ad pack</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 45px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">Your ad is ready 🎉</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px; font-weight: 500;">Built for ${brandName} in about a minute.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName} 👋</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                Here's the real ad LUMI built for you — your colors, your voice, ready to run.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 30px 40px; text-align: center;">
              <img src="${imageUrl}" alt="Your ad" style="max-width: 100%; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);" />
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 40px 35px 40px; text-align: center;">
              <a href="https://adsbylumi.com/join" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                Get 50% Off Your First Month →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                You're receiving this because you built an ad with LUMI and asked for a copy.
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
