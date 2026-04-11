import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/slack/api';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, reportId, slackOnly, slackChannelOverride } = await req.json();
    if (!brandId) throw new Error('brandId required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // If slackOnly test, send a test message and return
    if (slackOnly && slackChannelOverride) {
      await sendSlackMessage(slackChannelOverride, '✅ Test message from LUMI — your Slack integration is working!');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!reportId) throw new Error('reportId required');

    // Fetch report
    const { data: report } = await supabase
      .from('optimization_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (!report) throw new Error('Report not found');

    // Fetch brand + owner
    const { data: brand } = await supabase
      .from('brands')
      .select('name, user_id')
      .eq('id', brandId)
      .single();

    if (!brand) throw new Error('Brand not found');

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', brand.user_id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Fetch digest settings
    const { data: digestSettings } = await supabase
      .from('digest_settings')
      .select('additional_emails, slack_channel_id, report_auto_send')
      .eq('brand_id', brandId)
      .single();

    // Check auto-send setting — if false, mark as pending and skip sending
    if (digestSettings && digestSettings.report_auto_send === false) {
      await supabase
        .from('optimization_reports')
        .update({ status: 'pending_approval' })
        .eq('id', reportId);

      return new Response(JSON.stringify({ success: true, status: 'pending_approval' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipients = [profile.email];
    if (digestSettings?.additional_emails?.length) {
      recipients.push(...digestSettings.additional_emails);
    }

    const reportData = report.report_data as any[];
    const summary = report.summary as any;
    const firstName = profile.full_name?.split(' ')[0] || 'there';
    const shareUrl = `https://adsbylumi.com/report/${report.share_token}`;

    // Build & send email
    const emailHtml = buildDigestEmail(
      firstName,
      brand.name,
      report.date_range_start,
      report.date_range_end,
      reportData,
      summary,
      shareUrl
    );

    const { error: emailError } = await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: recipients,
      subject: `Weekly Ad Performance — ${brand.name} | ${report.date_range_start} – ${report.date_range_end}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Digest email error:', emailError);
      throw new Error(emailError.message);
    }

    // Slack notification disabled

    // Update last_sent_at
    await supabase
      .from('digest_settings')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('brand_id', brandId);

    console.log(`Optimization digest sent to ${recipients.join(', ')}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error sending digest:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    });
  }
});

async function sendSlackMessage(channel: string, text: string) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY');

  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
  if (!SLACK_API_KEY) throw new Error('SLACK_API_KEY not configured — connect Slack first');

  const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': SLACK_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Slack API error [${response.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

function buildSlackMessage(
  brandName: string,
  dateStart: string,
  dateEnd: string,
  summary: any,
  shareUrl: string
): string {
  return [
    `📊 *${brandName} — Weekly Ad Performance*`,
    `_${dateStart} – ${dateEnd}_`,
    '',
    `🟢 ${summary?.green || 0} on track  ·  🟡 ${summary?.yellow || 0} need attention  ·  🔴 ${summary?.red || 0} need action`,
    '',
    `<${shareUrl}|View Full Report →>`,
  ].join('\n');
}

function getStatusEmoji(status: string) {
  if (status === 'green') return '🟢';
  if (status === 'yellow') return '🟡';
  if (status === 'red') return '🔴';
  return '⚪';
}

function formatKpiValue(value: number, kpi: string) {
  if (['cpl', 'cpc', 'cplpv', 'cppv', 'cp2sc', 'cpm'].includes(kpi)) return `$${value.toFixed(2)}`;
  if (kpi === 'roas') return `${value.toFixed(1)}x`;
  if (kpi === 'ctr') return `${(value * 100).toFixed(1)}%`;
  return String(value);
}

function buildDigestEmail(
  firstName: string,
  brandName: string,
  dateStart: string,
  dateEnd: string,
  reportData: any[],
  summary: any,
  shareUrl: string
): string {
  const campaignRows = reportData
    .filter(c => c.status !== 'unconfigured' && c.status !== 'error' && c.status !== 'no_data')
    .sort((a, b) => {
      const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    })
    .map(c => {
      const primaryLine = c.goals ? `${c.goals.primary_kpi_label}: ${formatKpiValue(c.primary_kpi_value, c.goals.primary_kpi)} (Goal: ${c.goals.primary_kpi_goal_type === 'less_than' ? '<' : '>'}${formatKpiValue(c.goals.primary_kpi_threshold, c.goals.primary_kpi)})` : '';
      const secondaryLine = c.goals?.secondary_kpi ? `${c.goals.secondary_kpi_label}: ${formatKpiValue(c.secondary_kpi_value || 0, c.goals.secondary_kpi)} (Goal: ${c.goals.secondary_kpi_goal_type === 'less_than' ? '<' : '>'}${formatKpiValue(c.goals.secondary_kpi_threshold, c.goals.secondary_kpi)})` : '';
      const freqLine = c.metrics?.frequency ? `Frequency: ${c.metrics.frequency.toFixed(1)} (Goal: <${c.goals?.frequency_threshold || 4})` : '';
      const recs = (c.recommendations || []).map((r: any) => `→ ${r.action}`).join('<br>');
      const hogs = (c.budget_hogs || []).map((h: any) => `⚠️ "${h.name}" spending disproportionately at $${h.costPerResult.toFixed(2)} CPR`).join('<br>');

      return `
        <tr><td style="padding:20px 0;border-bottom:1px solid #eee;">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${getStatusEmoji(c.status)} ${c.workspace_name}</div>
          ${primaryLine ? `<div style="margin:4px 0;color:#333;">${primaryLine}</div>` : ''}
          ${secondaryLine ? `<div style="margin:4px 0;color:#333;">${secondaryLine}</div>` : ''}
          ${freqLine ? `<div style="margin:4px 0;color:#333;">${freqLine}</div>` : ''}
          ${recs ? `<div style="margin:12px 0 4px;font-weight:600;color:#333;">LUMI recommends:</div><div style="color:#555;">${recs}</div>` : ''}
          ${hogs ? `<div style="margin:8px 0;padding:8px;background:#FFF7ED;border-radius:6px;color:#92400E;">${hogs}</div>` : ''}
        </td></tr>`;
    }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#FAF9F6;font-family:'Red Hat Display',Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-size:24px;font-weight:800;color:#111;margin:0;">${brandName}</h1>
        <p style="color:#666;margin:4px 0;">Ad Performance Review · ${dateStart} – ${dateEnd}</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #eee;">
        <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;">Summary</h2>
        <div style="display:flex;gap:16px;text-align:center;">
          <span>🟢 ${summary.green || 0} on track</span> · 
          <span>🟡 ${summary.yellow || 0} need attention</span> · 
          <span>🔴 ${summary.red || 0} need action</span>
        </div>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #eee;">
        <table style="width:100%;border-collapse:collapse;">${campaignRows}</table>
      </div>
      <div style="text-align:center;margin-top:32px;">
        <a href="https://adsbylumi.com/ad-performance" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#F97316,#EC4899);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">View Full Dashboard</a>
        <br><br>
        <a href="${shareUrl}" style="color:#666;font-size:14px;">Share report with client →</a>
      </div>
      <div style="text-align:center;margin-top:32px;color:#999;font-size:12px;">
        Sent by LUMI · <a href="https://adsbylumi.com/ad-performance" style="color:#999;">Manage digest settings</a>
      </div>
    </div>
  </body></html>`;
}
