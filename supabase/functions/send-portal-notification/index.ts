import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { portalId, action, productionItemId, comment, clientName } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch portal to get created_by and portal_name
    const { data: portalData } = await supabase.rpc('validate_portal_access', {
      p_portal_id: portalId,
    });

    if (!portalData) {
      console.log('Portal not found for notification');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const portal = portalData;

    // Fetch creator email
    const { data: userData } = await supabase.auth.admin.getUserById(portal.created_by);
    const userEmail = userData?.user?.email;

    if (!userEmail) {
      console.log('Creator email not found');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const actionLabel = action === 'approved' ? 'Approved ✅' : 'Requested Changes 🔄';
    const displayClient = clientName || portal.client_name || 'Your client';

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: [userEmail],
      subject: `[LUMI] Client action on ${portal.portal_name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Red Hat Display', -apple-system, sans-serif; background-color: #FAF9F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Client Portal Update</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 16px 0; color: #111; font-size: 15px; line-height: 1.6;">Your client took action on a creative item.</p>
              <table width="100%" cellpadding="12" cellspacing="0" style="background: #FAF9F6; border-radius: 12px; margin-bottom: 20px;">
                <tr><td style="color: #666; font-size: 13px;">Portal</td><td style="color: #111; font-size: 14px; font-weight: 600;">${portal.portal_name}</td></tr>
                <tr><td style="color: #666; font-size: 13px;">Client</td><td style="color: #111; font-size: 14px; font-weight: 600;">${displayClient}</td></tr>
                <tr><td style="color: #666; font-size: 13px;">Action</td><td style="color: #111; font-size: 14px; font-weight: 600;">${actionLabel}</td></tr>
                ${comment ? `<tr><td style="color: #666; font-size: 13px;">Comment</td><td style="color: #111; font-size: 14px;">"${comment}"</td></tr>` : ''}
              </table>
              <div style="text-align: center;">
                <a href="https://adsbylumi.com/creative-studio" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-size: 14px; font-weight: 700;">View Activity in LUMI →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background: #FAF9F6; padding: 18px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px;">Lumi by Ads by Lumi · Meta Ads, Simplified</p>
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

    console.log(`Portal notification sent to ${userEmail} for ${action}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // Never throw - log and return success
    console.error('Portal notification error (non-fatal):', error);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
