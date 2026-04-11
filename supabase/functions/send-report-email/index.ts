import { createClient } from 'npm:@supabase/supabase-js@2';
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
    const { reportText, recipientEmail, brandName, dateRangeStart, dateRangeEnd } = await req.json();

    if (!reportText || !recipientEmail) {
      throw new Error('reportText and recipientEmail are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Convert markdown-ish report to HTML email
    const reportHtml = convertReportToHtml(reportText);
    const dateLabel = dateRangeStart && dateRangeEnd
      ? `${dateRangeStart} – ${dateRangeEnd}`
      : 'Recent Performance';

    const emailHtml = buildEmailWrapper({
      brandName: brandName || 'Your Brand',
      dateLabel,
      reportHtml,
    });

    const { error: emailError } = await resend.emails.send({
      from: 'Lumi <reports@adsbylumi.com>',
      to: [recipientEmail],
      subject: `📊 Performance Report: ${brandName || 'Your Brand'} — ${dateLabel}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Email send failed:', emailError);
      throw new Error((emailError as any).message || 'Failed to send email');
    }

    console.log(`Report emailed to ${recipientEmail} by user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in send-report-email:', error);
    const corsH = getCorsHeaders(req.headers.get('origin'));
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsH, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function convertReportToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // Headers
      if (line.startsWith('### ')) {
        return `<h3 style="margin:20px 0 8px;font-size:16px;font-weight:800;color:#111;">${line.replace('### ', '')}</h3>`;
      }
      if (line.startsWith('## ')) {
        return `<h2 style="margin:24px 0 10px;font-size:18px;font-weight:800;color:#111;">${line.replace('## ', '')}</h2>`;
      }
      // Checklist items
      if (line.match(/^-\s*\[[ x]\]/)) {
        const checked = line.includes('[x]');
        const content = line.replace(/^-\s*\[[ x]\]\s*/, '');
        return `<div style="padding:6px 0;font-size:13px;color:#374151;">${checked ? '✅' : '☐'} ${content}</div>`;
      }
      // Bold text
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Bullet points
      if (processed.startsWith('- ')) {
        return `<div style="padding:3px 0 3px 16px;font-size:13px;color:#374151;">• ${processed.substring(2)}</div>`;
      }
      // Horizontal rule
      if (line.startsWith('---')) {
        return '<hr style="border:none;border-top:1px solid #E2E8F0;margin:16px 0;">';
      }
      // Empty line
      if (!line.trim()) return '<br>';
      // Normal paragraph
      return `<p style="margin:4px 0;font-size:13px;color:#374151;line-height:1.7;">${processed}</p>`;
    })
    .join('\n');
}

function buildEmailWrapper(params: { brandName: string; dateLabel: string; reportHtml: string }): string {
  const { brandName, dateLabel, reportHtml } = params;

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Performance Report</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');</style>
</head><body style="margin:0;padding:0;font-family:'Red Hat Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#FAF9F6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF9F6;padding:30px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#F97316 0%,#EC4899 40%,#A78BFA 70%,#93C5FD 100%);padding:35px 40px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:-.5px;">📊 Performance Report</h1>
  <p style="color:rgba(255,255,255,.9);margin:10px 0 0;font-size:15px;font-weight:500;">${brandName} · ${dateLabel}</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:30px 40px;">
  ${reportHtml}
</td></tr>

<!-- CTA -->
<tr><td style="padding:10px 40px 35px;text-align:center;">
  <a href="https://adsbylumi.com/ad-performance" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899 50%,#A78BFA);color:#fff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 6px 20px rgba(236,72,153,.3);letter-spacing:.3px;">View Full Dashboard →</a>
</td></tr>

<!-- Footer -->
<tr><td style="background:#FAF9F6;padding:22px 40px;text-align:center;border-top:1px solid #F5F3EE;">
  <p style="margin:0;color:#a0aec0;font-size:11px;line-height:1.6;">Lumi by Ads by Lumi · Meta Ads, Simplified<br/>This report was manually sent via LUMI.</p>
</td></tr>

</table></td></tr></table></body></html>`;
}
