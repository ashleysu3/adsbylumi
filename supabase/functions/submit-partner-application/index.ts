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
    const {
      firstName, lastName, email, website,
      audienceDescription, promotionPlan, howWillYouShare,
      applicationType
    } = await req.json();

    if (!firstName || !lastName || !email || !applicationType) {
      return new Response(
        JSON.stringify({ error: true, message: 'Required fields missing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Insert application
    const { error: insertError } = await supabase.from('partner_applications').insert({
      first_name: firstName,
      last_name: lastName,
      email,
      website: website || null,
      audience_description: audienceDescription || null,
      promotion_plan: promotionPlan || null,
      how_will_you_share: howWillYouShare || null,
      application_type: applicationType,
      status: 'pending',
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to save application');
    }

    let referralLink: string | undefined;
    let referralCode: string | undefined;

    if (applicationType === 'affiliate') {
      // Create affiliate in Rewardful immediately
      const apiSecret = Deno.env.get('REWARDFUL_API_SECRET')!;
      const campaignId = Deno.env.get('REWARDFUL_STANDARD_CAMPAIGN_ID')!;
      const authHeader = 'Basic ' + btoa(apiSecret + ':');

      const res = await fetch('https://api.getrewardful.com/v1/affiliates', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          campaign_id: campaignId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        referralLink = data.links?.[0]?.url || data.referral_link || '';
        referralCode = data.links?.[0]?.token || data.referral_code || '';

        // Update application with rewardful ID
        await supabase.from('partner_applications')
          .update({ rewardful_affiliate_id: data.id, status: 'approved' })
          .eq('email', email)
          .eq('application_type', 'affiliate');
      } else if (res.status === 422 && JSON.stringify(data).toLowerCase().includes('already')) {
        return new Response(
          JSON.stringify({ success: true, applicationType, exists: true, message: 'Account already exists' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('Rewardful error:', data);
        // Application saved but Rewardful failed - still return success
      }
    } else {
      // Partner application - send admin notification email
      try {
        const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
        await resend.emails.send({
          from: 'Lumi <hello@adsbylumi.com>',
          to: ['hello@adsbylumi.com'],
          subject: `New LUMI Partner Application — ${firstName} ${lastName}`,
          html: `
            <div style="font-family: 'Red Hat Display', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #111;">New Partner Application</h2>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; font-weight: 600; color: #666;">Name</td><td style="padding: 8px;">${firstName} ${lastName}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600; color: #666;">Email</td><td style="padding: 8px;">${email}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600; color: #666;">Website</td><td style="padding: 8px;">${website || 'Not provided'}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600; color: #666;">Audience</td><td style="padding: 8px;">${audienceDescription || 'Not provided'}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600; color: #666;">Promotion Plan</td><td style="padding: 8px;">${promotionPlan || 'Not provided'}</td></tr>
              </table>
              <p style="color: #666; margin-top: 24px;">Log in to your LUMI admin dashboard to review and approve this application.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Admin notification email failed:', emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, applicationType, referralLink, referralCode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('submit-partner-application error:', error);
    return new Response(
      JSON.stringify({ error: true, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
