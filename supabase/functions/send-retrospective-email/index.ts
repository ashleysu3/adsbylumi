import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// send-retrospective-email (Patch #27)
//
// Sends a campaign retrospective as a styled HTML email. Pulls the cached
// retrospective_json from the workspace, layers in agency_branding when
// the user has white-label reports enabled, builds a branded inline-styled
// HTML email, and sends via Resend.
//
// Inputs:  { workspaceId, recipientEmail, recipientName?, senderNote? }
// ============================================================================

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { workspaceId, recipientEmail, recipientName, senderNote } = body;

    if (!workspaceId || !recipientEmail) {
      return json({ error: 'workspaceId and recipientEmail are required' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(recipientEmail))) {
      return json({ error: 'Invalid recipient email address' }, 400);
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Workspace + ownership.
    const { data: workspace, error: wErr } = await sb
      .from('campaign_workspaces')
      .select('id, brand_id, name, offer_name, retrospective_json')
      .eq('id', workspaceId).single();
    if (wErr || !workspace) return json({ error: 'Workspace not found' }, 404);
    if (!workspace.retrospective_json) {
      return json({ error: 'No retrospective generated for this campaign yet' }, 400);
    }

    const { data: brand, error: bErr } = await sb
      .from('brands').select('id, user_id, name').eq('id', workspace.brand_id).single();
    if (bErr || !brand) return json({ error: 'Brand not found' }, 404);
    if (brand.user_id !== user.id) return json({ error: 'Forbidden' }, 403);

    // Sender's name (for the From-line + footer).
    const { data: senderProfile } = await sb
      .from('profiles').select('full_name, email').eq('id', user.id).single();
    const senderName = senderProfile?.full_name || senderProfile?.email || brand.name;

    // Optional agency branding for white-label.
    const { data: agency } = await sb
      .from('agency_branding')
      .select('logo_url, company_name, primary_color, accent_color, custom_footer_text, white_label_reports')
      .eq('brand_id', brand.id).maybeSingle();
    const useWhiteLabel = !!agency?.white_label_reports;

    const headerLogoUrl = useWhiteLabel ? (agency?.logo_url || null) : null;
    const headerName = useWhiteLabel ? (agency?.company_name || brand.name) : brand.name;
    const primaryColor = (useWhiteLabel && agency?.primary_color) || '#7c3aed';
    const footerText = useWhiteLabel && agency?.custom_footer_text
      ? agency.custom_footer_text
      : 'Sent via LUMI · adsbylumi.com';

    const html = renderEmail({
      retro: workspace.retrospective_json as any,
      campaignName: workspace.offer_name || workspace.name || 'Campaign',
      brandName: brand.name,
      senderName,
      senderNote: typeof senderNote === 'string' ? senderNote.slice(0, 1500) : null,
      recipientName: typeof recipientName === 'string' ? recipientName : null,
      headerLogoUrl, headerName, primaryColor, footerText,
    });

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ error: 'RESEND_API_KEY not configured' }, 500);
    const resend = new Resend(resendKey);

    const subject = `Campaign retrospective — ${workspace.offer_name || workspace.name || brand.name}`;

    const { error: sendErr } = await resend.emails.send({
      from: 'LUMI <reports@adsbylumi.com>',
      to: [recipientEmail],
      replyTo: senderProfile?.email,
      subject,
      html,
    });

    if (sendErr) {
      console.error('Resend error:', sendErr);
      return json({ error: 'Failed to send email: ' + (sendErr.message || 'unknown') }, 502);
    }

    return json({ success: true });
  } catch (err: any) {
    console.error('send-retrospective-email error:', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// HTML email rendering — inline-styled for compatibility across mail clients.
// ---------------------------------------------------------------------------

function renderEmail(args: {
  retro: any;
  campaignName: string;
  brandName: string;
  senderName: string;
  senderNote: string | null;
  recipientName: string | null;
  headerLogoUrl: string | null;
  headerName: string;
  primaryColor: string;
  footerText: string;
}): string {
  const r = args.retro || {};
  const stats = r.stats || {};
  const goalSet = stats.goal_threshold != null;
  const hit = stats.goal_hit;
  const goalLine = goalSet
    ? `${stats.goal_label || 'Goal'} ${stats.goal_direction === 'greater_than' ? '≥' : '≤'} ${formatVal(stats.goal_threshold, stats.goal_unit)}${
        stats.goal_actual != null
          ? ` &nbsp;→&nbsp; <strong style="color:${hit ? '#059669' : '#dc2626'}">${formatVal(stats.goal_actual, stats.goal_unit)}</strong>`
          : ''
      }`
    : null;

  const wins = Array.isArray(r.wins) ? r.wins : [];
  const underperformers = Array.isArray(r.misses) ? r.misses : [];
  const tests = Array.isArray(r.recommendations) ? r.recommendations : [];

  const greeting = args.recipientName
    ? `Hey ${escape(args.recipientName)},`
    : 'Hey,';
  const fromLine = `${escape(args.senderName)} put together this retrospective for "${escape(args.campaignName)}" and asked us to share it with you.`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background:${args.primaryColor};padding:22px 28px;color:#ffffff;">
          ${args.headerLogoUrl
            ? `<img src="${escapeAttr(args.headerLogoUrl)}" alt="${escapeAttr(args.headerName)}" style="max-height:36px;max-width:200px;display:block;margin-bottom:8px;"/>`
            : ''}
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">${escape(args.headerName)} · Campaign Retrospective</div>
          <div style="font-size:22px;font-weight:600;margin-top:4px;line-height:1.25;">${escape(args.campaignName)}</div>
          <div style="font-size:13px;opacity:0.85;margin-top:6px;">Generated ${new Date(r.generated_at || Date.now()).toLocaleString()}</div>
        </td></tr>

        <!-- Greeting + sender note -->
        <tr><td style="padding:24px 28px 8px;font-size:15px;line-height:1.55;">
          <p style="margin:0 0 12px;">${greeting}</p>
          <p style="margin:0;">${fromLine}</p>
          ${args.senderNote
            ? `<div style="margin-top:14px;padding:12px 14px;border-left:3px solid ${args.primaryColor};background:#f9fafb;border-radius:0 6px 6px 0;font-size:14px;color:#374151;">${escape(args.senderNote).replace(/\n/g, '<br/>')}</div>`
            : ''}
        </td></tr>

        <!-- Goal vs actual -->
        ${goalLine
          ? `<tr><td style="padding:8px 28px 0;">
              <div style="border:1px solid ${hit ? '#a7f3d0' : '#fecaca'};background:${hit ? '#ecfdf5' : '#fef2f2'};border-radius:10px;padding:14px 16px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${hit ? '#059669' : '#dc2626'};font-weight:600;">${hit ? 'Goal hit' : 'Goal missed'}</div>
                <div style="margin-top:4px;font-size:16px;font-weight:600;">${goalLine}</div>
                ${stats.goal_delta_pct != null ? `<div style="margin-top:4px;font-size:13px;color:#6b7280;">${Math.abs(stats.goal_delta_pct).toFixed(1)}% ${hit ? 'better than target' : 'off target'}</div>` : ''}
              </div>
            </td></tr>`
          : ''}

        <!-- Stats strip -->
        <tr><td style="padding:14px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${statTile('Spend', formatCurrency(stats.total_spend))}
              ${statTile('Results', formatNumber(stats.total_results))}
              ${statTile('Avg ' + (stats.primary_kpi_label || 'cost / result'), stats.avg_cpl != null ? formatCurrency(stats.avg_cpl) : '—')}
              ${statTile('Duration', stats.duration_days != null ? `${stats.duration_days}d` : '—')}
            </tr>
          </table>
        </td></tr>

        <!-- Narrative -->
        ${r.narrative
          ? `<tr><td style="padding:8px 28px 4px;font-size:15px;line-height:1.65;color:#1f2937;">
              ${String(r.narrative).split(/\n\n+/).map(p => `<p style="margin:0 0 12px;">${escape(p)}</p>`).join('')}
            </td></tr>`
          : ''}

        <!-- What worked -->
        ${section('What worked', wins, '#059669', '#ecfdf5')}
        <!-- Underperformers -->
        ${section('What underperformed (and why)', underperformers, '#d97706', '#fffbeb')}
        <!-- Test ideas -->
        ${section('Worth testing next', tests, args.primaryColor, '#f5f3ff', true)}

        ${r.data_quality === 'low' || r.data_quality === 'insufficient'
          ? `<tr><td style="padding:0 28px 16px;">
              <div style="border:1px solid #fcd34d;background:#fffbeb;border-radius:10px;padding:12px 14px;font-size:13px;color:#92400e;">
                <strong>${r.data_quality === 'insufficient' ? 'Not enough data for a confident debrief.' : 'Limited data — read with caution.'}</strong>
                ${r.data_quality_note ? `<div style="margin-top:6px;color:#78350f;">${escape(r.data_quality_note)}</div>` : ''}
              </div>
            </td></tr>`
          : ''}

        <!-- Footer -->
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5;">
          ${escape(args.footerText)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function section(title: string, items: any[], accent: string, bg: string, withArrow: boolean = false): string {
  if (!items || items.length === 0) return '';
  return `<tr><td style="padding:6px 28px 4px;">
    <h3 style="margin:14px 0 8px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${accent};">${escape(title)}</h3>
    ${items.map(item => `
      <div style="border:1px solid ${accent}33;background:${bg};border-radius:8px;padding:11px 13px;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:600;color:#111827;">${withArrow ? '→ ' : ''}${escape(item.insight || '')}</div>
        ${item.supporting_data
          ? `<div style="font-size:12px;color:#6b7280;margin-top:5px;line-height:1.5;">${escape(item.supporting_data)}</div>`
          : ''}
      </div>
    `).join('')}
  </td></tr>`;
}

function statTile(label: string, value: string): string {
  return `<td style="padding:0 6px;width:25%;vertical-align:top;">
    <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:10px 12px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:600;">${escape(label)}</div>
      <div style="font-size:16px;font-weight:700;margin-top:4px;color:#111827;">${escape(value)}</div>
    </div>
  </td>`;
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(n));
}
function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat().format(Math.round(Number(n)));
}
function formatVal(n: number | null | undefined, unit: string | null | undefined): string {
  if (n == null) return '—';
  const v = Number(n);
  if (unit === '$') return `$${v.toFixed(2)}`;
  if (unit === 'x') return `${v.toFixed(2)}x`;
  if (unit === '%') return `${v.toFixed(2)}%`;
  return String(v);
}
function escape(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s: any): string {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
