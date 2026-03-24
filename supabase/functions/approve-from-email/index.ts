import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return htmlResponse('Missing Token', 'No approval token was provided. Please use the link from your email.', false);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up token
    const { data: tokenRow, error: tokenError } = await supabase
      .from('email_approval_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRow) {
      return htmlResponse('Invalid Token', 'This approval link is invalid or has already been used.', false);
    }

    if (tokenRow.status === 'used') {
      return htmlResponse('Already Approved', 'This change was already approved. No further action needed! ✅', true);
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await supabase.from('email_approval_tokens').update({ status: 'expired' }).eq('id', tokenRow.id);
      return htmlResponse('Link Expired', 'This approval link has expired. Please check your latest report for updated recommendations.', false);
    }

    // Mark token as used
    await supabase.from('email_approval_tokens').update({ status: 'used' }).eq('id', tokenRow.id);

    // Insert into pending_optimizations as approved
    const { error: insertError } = await supabase.from('pending_optimizations').insert({
      brand_id: tokenRow.brand_id,
      workspace_id: tokenRow.workspace_id,
      recommendation_type: 'email_approval',
      action_description: tokenRow.action_description,
      meta_action: tokenRow.action_data,
      status: 'approved',
      resolved_at: new Date().toISOString(),
      resolved_by: tokenRow.user_id,
    });

    if (insertError) {
      console.error('Failed to insert optimization:', insertError);
      return htmlResponse('Error', 'Something went wrong processing your approval. Please try again from your dashboard.', false);
    }

    // Try to apply the optimization
    let applySuccess = false;
    try {
      const applyResp = await fetch(`${supabaseUrl}/functions/v1/apply-optimizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({ brandId: tokenRow.brand_id }),
      });
      applySuccess = applyResp.ok;
    } catch {
      console.error('Failed to call apply-optimizations');
    }

    // Send confirmation email
    try {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', tokenRow.user_id).single();

      if (profile?.email) {
        await resend.emails.send({
          from: 'Lumi <reports@adsbylumi.com>',
          to: [profile.email],
          subject: `✅ Change Approved: ${tokenRow.action_description.substring(0, 50)}...`,
          html: buildConfirmationEmail(profile.full_name || 'there', tokenRow.action_description, applySuccess),
        });
      }
    } catch (emailErr) {
      console.error('Confirmation email failed:', emailErr);
    }

    return htmlResponse('Approved! ✅', `Your change has been approved${applySuccess ? ' and is being applied now' : ''}. You'll receive a confirmation email shortly.`, true);
  } catch (error: any) {
    console.error('approve-from-email error:', error);
    return htmlResponse('Error', 'Something went wrong. Please try approving from your dashboard instead.', false);
  }
});

function htmlResponse(title: string, message: string, success: boolean): Response {
  const color = success ? '#22C55E' : '#EF4444';
  const emoji = success ? '✅' : '❌';
  return new Response(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Lumi</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&display=swap');
body{margin:0;padding:40px 20px;font-family:'Red Hat Display',sans-serif;background:#FAF9F6;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:48px;max-width:480px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.06)}
.icon{font-size:48px;margin-bottom:16px}
h1{margin:0 0 12px;font-size:24px;font-weight:800;color:#111}
p{margin:0;font-size:15px;color:#4a5568;line-height:1.7}
.btn{display:inline-block;margin-top:24px;background:linear-gradient(135deg,#F97316,#EC4899,#A78BFA);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px}
</style></head><body><div class="card">
<div class="icon">${emoji}</div>
<h1>${title}</h1>
<p>${message}</p>
<a href="https://adsbylumi.com/data" class="btn">Go to Dashboard →</a>
</div></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  });
}

function buildConfirmationEmail(userName: string, actionDescription: string, applied: boolean): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&display=swap');</style>
</head><body style="margin:0;padding:0;font-family:'Red Hat Display',sans-serif;background:#FAF9F6">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<tr><td style="background:linear-gradient(135deg,#22C55E,#10B981);padding:30px 40px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">✅ Change Approved</h1>
</td></tr>
<tr><td style="padding:30px 40px">
<p style="margin:0;color:#111;font-size:16px;font-weight:600">Hey ${userName} 👋</p>
<p style="margin:12px 0;color:#4a5568;font-size:14px;line-height:1.7">You approved the following change from your performance report:</p>
<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;margin:16px 0">
<p style="margin:0;color:#166534;font-size:14px;font-weight:600">${actionDescription}</p>
</div>
<p style="margin:12px 0;color:#4a5568;font-size:14px;line-height:1.7">${applied ? 'This change has been applied to your campaigns.' : 'This change has been queued and will be applied shortly.'}</p>
<p style="margin:20px 0 0;text-align:center"><a href="https://adsbylumi.com/data" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px">View Dashboard →</a></p>
</td></tr>
<tr><td style="background:#FAF9F6;padding:20px 40px;text-align:center;border-top:1px solid #F5F3EE">
<p style="margin:0;color:#a0aec0;font-size:11px">Lumi by Ads by Lumi · Meta Ads, Simplified</p>
</td></tr>
</table></td></tr></table></body></html>`;
}
