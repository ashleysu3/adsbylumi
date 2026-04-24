import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

// ============================================================================
// send-render-ready-email
//
// Called by the in-browser render queue (RenderQueueContext) when a b-roll
// text-overlay render completes and the MP4 has been uploaded to Supabase
// storage. Sends the authenticated user an email with a download link so
// they can grab the MP4 from any device / come back to it later.
//
// Body:
//   {
//     downloadUrl: string,       // public Supabase URL
//     filename: string,          // e.g. "coffee-pour-with-text.mp4"
//     clipName?: string,         // original b-roll file name (human context)
//     title?: string,            // human-readable job title
//     brandId?: string           // optional brand tag for the email body
//   }
//
// Auth: uses the caller's JWT to resolve the target email. Since this is
// only ever invoked from the user's own browser session, that's the right
// user to notify.
// ============================================================================

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401, corsHeaders);
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: 'Invalid session' }, 401, corsHeaders);
    }
    const user = userData.user;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { downloadUrl, filename, clipName, title, brandId } = await req.json();
    if (!downloadUrl || !filename) {
      return json({ error: 'Missing downloadUrl or filename' }, 400, corsHeaders);
    }

    // Profile for first name in the greeting.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // Brand name for context in the email copy, when we have one.
    let brandName: string | null = null;
    if (brandId) {
      const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('name')
        .eq('id', brandId)
        .single();
      brandName = brand?.name || null;
    }

    const toEmail = profile?.email || user.email;
    if (!toEmail) {
      return json({ error: 'No email on file for this user' }, 400, corsHeaders);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return json({ error: 'Resend not configured' }, 500, corsHeaders);
    }
    const resend = new Resend(resendKey);

    const userName = (profile?.full_name || '').split(' ')[0] || 'there';
    const jobLabel = title || clipName || filename;

    await resend.emails.send({
      from: 'Lumi <reports@adsbylumi.com>',
      to: [toEmail],
      subject: `🎬 Your video is ready: ${jobLabel.substring(0, 60)}`,
      html: buildHtml({
        userName,
        brandName,
        jobLabel,
        downloadUrl,
        filename,
      }),
    });

    return json({ success: true }, 200, corsHeaders);
  } catch (error: any) {
    console.error('send-render-ready-email error:', error);
    return json({ error: error?.message || 'Unknown error' }, 500, getCorsHeaders(req.headers.get('origin')));
  }
});

function json(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string));
}

function buildHtml(args: {
  userName: string;
  brandName: string | null;
  jobLabel: string;
  downloadUrl: string;
  filename: string;
}): string {
  const { userName, brandName, jobLabel, downloadUrl, filename } = args;
  const brandLine = brandName ? `<p style="margin:4px 0 16px;font-size:13px;color:#64748B;">Brand: ${escape(brandName)}</p>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&display=swap');</style>
</head><body style="margin:0;padding:0;font-family:'Red Hat Display',sans-serif;background:#FAF9F6">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<tr><td style="background:linear-gradient(135deg,#F97316,#EC4899,#A78BFA);padding:32px 40px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:24px;font-weight:800">🎬 Your video is ready</h1>
</td></tr>
<tr><td style="padding:30px 40px">
<p style="margin:0;color:#111;font-size:16px;font-weight:600">Hey ${escape(userName)} 👋</p>
<p style="margin:12px 0 4px;color:#4a5568;font-size:14px;line-height:1.7">Your rendered MP4 is ready — text burned in, ready to upload to Meta.</p>
${brandLine}
<div style="background:#FAFBFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin:16px 0">
<p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">File</p>
<p style="margin:0;color:#111;font-size:14px;font-weight:600">${escape(jobLabel)}</p>
<p style="margin:4px 0 0;color:#64748B;font-size:12px">${escape(filename)}</p>
</div>
<p style="margin:20px 0 0;text-align:center">
  <a href="${escape(downloadUrl)}" download="${escape(filename)}" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px">
    Download MP4 →
  </a>
</p>
<p style="margin:16px 0 0;color:#a0aec0;font-size:11px;line-height:1.6;text-align:center">
  Link expires when Lumi rotates storage. Download now or grab it in-app any time — the bell icon in Lumi keeps your recent renders.
</p>
</td></tr>
<tr><td style="background:#FAF9F6;padding:20px 40px;text-align:center;border-top:1px solid #F5F3EE">
<p style="margin:0;color:#a0aec0;font-size:11px">Lumi by Ads by Lumi · Meta Ads, Simplified</p>
</td></tr>
</table></td></tr></table></body></html>`;
}
