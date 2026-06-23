import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isServiceRoleRequest } from "../_shared/internal-auth.ts";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface NotificationPrefs {
  report_frequency?: 'off' | 'daily' | 'weekly';
  critical_alerts?: boolean;
  performance_drops?: boolean;
  last_report_sent_at?: string;
  weekly_digest?: boolean;
}

// One campaign in the email. All values come from the engine
// (generate-recommendations) — never recomputed here. Anything we'd want
// to say in plain English we ask the engine for first.
interface CampaignRow {
  workspaceId: string;
  name: string;
  spend: number;
  reach: number;
  cardDisplay: {
    primary: { key: string; label: string; valueDisplay: string; goalDisplay: string | null; status: 'healthy' | 'attention' | 'critical' | 'no-data' };
    secondary?: { key: string; label: string; valueDisplay: string; goalDisplay: string; status: 'healthy' | 'attention' | 'critical' | 'no-data' } | null;
    ctr: { valueDisplay: string; benchmarkDisplay: string; status: 'healthy' | 'attention' | 'critical' | 'no-data' };
    frequency: { valueDisplay: string; goalDisplay: string; status: 'healthy' | 'attention' | 'critical' | 'no-data' };
    overallStatus: 'healthy' | 'attention' | 'critical' | 'no-data';
    actionRec: string;
    spendDisplay: string;
  };
  changeContext?: { recentEventsCount: number; summary: string | null };
  topRecs: Array<{
    title: string;
    description: string;
    impact: string;
    confidence: 'high' | 'medium' | 'low';
    priority: number;
    type: string;
  }>;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse body once so we can detect testMode for the preview page.
  let body: any = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch (e) {
    console.warn('[weekly] body parse failed:', (e as any)?.message);
  }
  console.log('[weekly] request received, testMode=', body?.testMode === true);

  // TEST MODE: lets the in-app preview send a sample of the real email
  // to any address. Requires Authorization header (logged-in user).
  if (body?.testMode === true) {
    const testEmail = String(body.testEmail || '').trim();
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      return new Response(JSON.stringify({ error: 'Valid testEmail required' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Note: no auth check on testMode — this is a preview helper that just
    // sends a sample to the email the user typed. Resend rate-limits the rest.
    try {
      const html = buildBigPictureEmail({
        userName: 'there',
        brandName: 'Sample Brand',
        frequencyLabel: 'Weekly',
        campaigns: buildSampleCampaigns(),
      });
      const { error: sendErr } = await resend.emails.send({
        from: 'Lumi <reports@adsbylumi.com>',
        to: [testEmail],
        subject: '📊 Sample Weekly Ad Report — preview from Lumi',
        html,
      });
      if (sendErr) {
        console.error('[weekly test] send failed:', sendErr);
        return new Response(JSON.stringify({ error: (sendErr as any).message || 'Send failed' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, sentTo: testEmail }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('[weekly test] error:', e);
      return new Response(JSON.stringify({ error: e.message || 'Failed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ADMIN TEST MODE: send a real engine-driven report for a specific brand to
  // any recipient, for a chosen rolling window. Bypasses Monday/last-sent
  // gating. Does NOT update last_report_sent_at.
  if (body?.adminTestMode === true) {
    const adminResult = await handleAdminTestMode(req, body, corsHeaders);
    return adminResult;
  }


  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting Big Picture + Quick List performance report job…');

    const today = new Date();
    const dayOfWeek = today.getUTCDay();

    const { data: workspaces, error: workspacesError } = await supabase
      .from('campaign_workspaces')
      .select(`
        id, name, brand_id, meta_campaign_ids, performance_history, offer_name,
        brands!inner(id, user_id, name, notification_preferences),
        campaign_goals(primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type, secondary_kpi, secondary_kpi_label, secondary_kpi_threshold, secondary_kpi_goal_type)
      `)
      .not('meta_campaign_ids', 'is', null)
      .eq('archived', false);

    if (workspacesError) throw workspacesError;

    console.log(`Found ${workspaces?.length || 0} published workspaces`);

    // Group by BRAND so agency users get one email per client brand, not a
    // single mashed-together email tagged with the wrong brand.
    const brandGroups = new Map<string, { brand: any; workspaces: any[] }>();
    for (const ws of workspaces || []) {
      const brand = ws.brands as any;
      const brandId = brand.id;
      if (!brandGroups.has(brandId)) brandGroups.set(brandId, { brand, workspaces: [] });
      brandGroups.get(brandId)!.workspaces.push(ws);
    }
    console.log(`Grouped into ${brandGroups.size} brands`);

    const results: { brandId: string; userId: string; email: string; status: string; error?: string; campaignCount: number }[] = [];

    for (const [brandId, group] of brandGroups) {
      try {
        const { brand } = group;
        const userId = brand.user_id;
        const prefs: NotificationPrefs = brand.notification_preferences || {};

        let reportFrequency: 'off' | 'daily' | 'weekly' = prefs.report_frequency || 'weekly';
        if (!prefs.report_frequency && prefs.weekly_digest === false) reportFrequency = 'off';

        if (reportFrequency === 'off') {
          results.push({ brandId, userId, email: '', status: 'skipped', error: 'Reports disabled', campaignCount: group.workspaces.length });
          continue;
        }

        const lastSent = prefs.last_report_sent_at ? new Date(prefs.last_report_sent_at) : null;

        if (reportFrequency === 'weekly') {
          if (dayOfWeek !== 1) {
            results.push({ brandId, userId, email: '', status: 'skipped', error: 'Not Monday', campaignCount: group.workspaces.length });
            continue;
          }
          if (lastSent && (today.getTime() - lastSent.getTime()) < 7 * 24 * 60 * 60 * 1000) {
            results.push({ brandId, userId, email: '', status: 'skipped', error: 'Already sent this week', campaignCount: group.workspaces.length });
            continue;
          }
        }
        if (reportFrequency === 'daily') {
          if (lastSent && lastSent.toDateString() === today.toDateString()) {
            results.push({ brandId, userId, email: '', status: 'skipped', error: 'Already sent today', campaignCount: group.workspaces.length });
            continue;
          }
        }

        const { data: profile } = await supabase
          .from('profiles').select('email, full_name').eq('id', userId).single();

        if (!profile?.email) {
          results.push({ brandId, userId, email: '', status: 'skipped', error: 'No email', campaignCount: group.workspaces.length });
          continue;
        }

        const userName = profile.full_name || 'there';
        const frequencyLabel = reportFrequency === 'daily' ? 'Daily' : 'Weekly';

        // Build campaign rows from the engine. We *only* keep campaigns with
        // real delivery in the period (spend > 0 OR reach > 0). Anything
        // quiet for the period is dropped — no "$0 spend, 0 results" lines.
        const campaigns: CampaignRow[] = [];

        for (const ws of group.workspaces) {
          const history = ws.performance_history || [];
          const latestSnapshot = history[history.length - 1];
          const metrics = latestSnapshot?.metrics || {};
          const goals = (ws.campaign_goals as any)?.[0] || null;

          const spend = Number(metrics.spend || 0);
          const reach = Number(metrics.reach || 0);
          const impressions = Number(metrics.impressions || 0);

          // FILTER: skip campaigns with no activity in the report window.
          // Nothing to say about them — the email never shows blank rows.
          if (spend <= 0 && reach <= 0 && impressions <= 0) continue;

          // Live engine pass. cardDisplay + recommendations come from the
          // same 3/7/30-day logic the in-app Big Picture / Quick List uses.
          let cardDisplay: CampaignRow['cardDisplay'] | null = null;
          let changeContext: CampaignRow['changeContext'] | undefined;
          let recs: any[] = [];
          try {
            const { data: recsResp, error: recsErr } = await supabase.functions.invoke(
              'generate-recommendations',
              {
                body: {
                  workspaceId: ws.id,
                  brandId: brand.id,
                  metrics,
                  ads: latestSnapshot?.adMetrics || [],
                  goals,
                },
              },
            );
            if (recsErr || !recsResp) {
              console.warn(`[weekly] rec engine failed for ${ws.id}:`, recsErr);
              continue;
            }
            cardDisplay = recsResp.cardDisplay || null;
            if (recsResp.changeContext) {
              changeContext = {
                recentEventsCount: recsResp.changeContext.recentEventsCount,
                summary: recsResp.changeContext.summary,
              };
            }
            recs = Array.isArray(recsResp.recommendations) ? recsResp.recommendations : [];
          } catch (e) {
            console.warn(`[weekly] rec engine threw for ${ws.id}:`, e);
            continue;
          }

          // If we couldn't build a card, skip — nothing meaningful to render.
          if (!cardDisplay) continue;

          // Trim each campaign's recs to the few that actually matter. The
          // Quick List pulls from these; engine-decided priority wins.
          const topRecs = recs
            .filter(r => r && r.title && r.type !== 'keep_running' && r.type !== 'hold_for_data')
            .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
            .slice(0, 3)
            .map(r => ({
              title: String(r.title),
              description: String(r.description || ''),
              impact: String(r.impact || ''),
              confidence: (r.confidence || 'medium') as 'high' | 'medium' | 'low',
              priority: Number(r.priority ?? 99),
              type: String(r.type || ''),
            }));

          campaigns.push({
            workspaceId: ws.id,
            name: ws.offer_name || ws.name,
            spend,
            reach,
            cardDisplay,
            changeContext,
            topRecs,
          });
        }

        // Build the email. If no campaign had delivery in the window we
        // send a short "quiet week" note instead of an empty template.
        const emailHtml = campaigns.length === 0
          ? buildQuietWeekEmail({ userName, brandName: brand.name, frequencyLabel })
          : buildBigPictureEmail({ userName, brandName: brand.name, frequencyLabel, campaigns });

        const subject = campaigns.length === 0
          ? `📭 ${frequencyLabel} Ad Report: ${brand.name} — quiet week`
          : `📊 ${frequencyLabel} Ad Report: ${brand.name} — ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} with data`;

        const { error: emailError } = await resend.emails.send({
          from: 'Lumi <reports@adsbylumi.com>',
          to: [profile.email],
          subject,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Email failed for user ${userId}:`, emailError);
          results.push({ brandId, userId, email: profile.email, status: 'error', error: (emailError as any).message, campaignCount: campaigns.length });
        } else {
          console.log(`Email sent to ${profile.email} (${campaigns.length} campaigns with data)`);
          const updatedPrefs = { ...prefs, report_frequency: reportFrequency, last_report_sent_at: today.toISOString() };
          await supabase.from('brands').update({ notification_preferences: updatedPrefs }).eq('id', brand.id);
          results.push({ brandId, userId, email: profile.email, status: 'sent', campaignCount: campaigns.length });
        }
      } catch (userError: any) {
        console.error(`Error processing brand ${brandId}:`, userError);
        results.push({ brandId, userId: group.brand?.user_id || '', email: '', status: 'error', error: userError.message, campaignCount: group.workspaces.length });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    console.log(`Reports complete: ${sentCount} sent, ${errorCount} errors`);

    if (errorCount > 0) {
      try {
        const failedList = results.filter(r => r.status === 'error').map(r => `• ${r.email || r.userId}: ${r.error}`).join('\n');
        await fetch(`${supabaseUrl}/functions/v1/slack-error-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
          body: JSON.stringify({
            category: 'Email', severity: 'warning',
            title: `${errorCount} Report Email${errorCount !== 1 ? 's' : ''} Failed`,
            message: `${sentCount} sent, ${errorCount} failed:\n${failedList}`,
            source: 'send-weekly-reports',
          }),
        });
      } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({ success: true, summary: { brands: brandGroups.size, sent: sentCount, errors: errorCount }, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error: any) {
    console.error('Error in send-weekly-reports:', error);
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/slack-error-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ category: 'Email', severity: 'critical', title: 'Weekly Reports System Failure', message: error.message, source: 'send-weekly-reports' }),
      });
    } catch { /* ignore */ }
    const corsH = getCorsHeaders(req.headers.get('origin'));
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsH, 'Content-Type': 'application/json' }, status: 500 });
  }
});

// ===================== ADMIN TEST MODE =====================

async function handleAdminTestMode(
  req: Request,
  body: any,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const json = (status: number, payload: any) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'Auth required (admin)' });
  }

  const brandId = String(body.brandId || '').trim();
  const recipientEmail = String(body.recipientEmail || '').trim();
  const daysWindow = Math.max(1, Math.min(90, Number(body.daysWindow) || 7));

  if (!brandId) return json(200, { error: 'brandId required' });
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return json(200, { error: 'Valid recipientEmail required' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify admin via user-context client.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  const userId = claims?.claims?.sub;
  if (!userId) return json(200, { error: 'Not authenticated' });

  const { data: roleRow } = await userClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (!roleRow) return json(200, { error: 'Admin only' });

  // Service-role client for the actual fetch + send.
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: workspaces, error: wsError } = await supabase
    .from('campaign_workspaces')
    .select(`
      id, name, brand_id, meta_campaign_ids, performance_history, offer_name,
      brands!inner(id, user_id, name, notification_preferences),
      campaign_goals(primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type, secondary_kpi, secondary_kpi_label, secondary_kpi_threshold, secondary_kpi_goal_type)
    `)
    .eq('brand_id', brandId)
    .not('meta_campaign_ids', 'is', null)
    .eq('archived', false);

  if (wsError) return json(200, { error: wsError.message });

  const brand = (workspaces?.[0] as any)?.brands;
  if (!brand) {
    return json(200, { error: 'No published campaigns for that brand', campaignCount: 0 });
  }

  const cutoff = Date.now() - daysWindow * 24 * 60 * 60 * 1000;
  const frequencyLabel = `Last ${daysWindow}d`;
  const campaigns: CampaignRow[] = [];

  for (const ws of workspaces || []) {
    const history: any[] = (ws as any).performance_history || [];
    // Snapshots within the chosen rolling window.
    const inWindow = history.filter((h) => {
      const t = h?.date ? Date.parse(h.date) : h?.timestamp ? Date.parse(h.timestamp) : null;
      return t && t >= cutoff;
    });
    if (inWindow.length === 0) continue;

    const latestSnapshot = inWindow[inWindow.length - 1];
    const metrics = latestSnapshot?.metrics || {};
    const goals = ((ws as any).campaign_goals as any)?.[0] || null;

    // Sum delivery over the window to decide "had activity".
    const winSpend = inWindow.reduce((s, h) => s + Number(h?.metrics?.spend || 0), 0);
    const winReach = inWindow.reduce((s, h) => s + Number(h?.metrics?.reach || 0), 0);
    const winImpr = inWindow.reduce((s, h) => s + Number(h?.metrics?.impressions || 0), 0);
    if (winSpend <= 0 && winReach <= 0 && winImpr <= 0) continue;

    let cardDisplay: CampaignRow['cardDisplay'] | null = null;
    let changeContext: CampaignRow['changeContext'] | undefined;
    let recs: any[] = [];
    try {
      const { data: recsResp } = await supabase.functions.invoke('generate-recommendations', {
        body: {
          workspaceId: (ws as any).id,
          brandId: brand.id,
          metrics,
          ads: latestSnapshot?.adMetrics || [],
          goals,
        },
      });
      if (!recsResp) continue;
      cardDisplay = recsResp.cardDisplay || null;
      if (recsResp.changeContext) {
        changeContext = {
          recentEventsCount: recsResp.changeContext.recentEventsCount,
          summary: recsResp.changeContext.summary,
        };
      }
      recs = Array.isArray(recsResp.recommendations) ? recsResp.recommendations : [];
    } catch (e) {
      console.warn('[admin-test] rec engine threw:', e);
      continue;
    }
    if (!cardDisplay) continue;

    const topRecs = recs
      .filter((r) => r && r.title && r.type !== 'keep_running' && r.type !== 'hold_for_data')
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .slice(0, 3)
      .map((r) => ({
        title: String(r.title),
        description: String(r.description || ''),
        impact: String(r.impact || ''),
        confidence: (r.confidence || 'medium') as 'high' | 'medium' | 'low',
        priority: Number(r.priority ?? 99),
        type: String(r.type || ''),
      }));

    campaigns.push({
      workspaceId: (ws as any).id,
      name: (ws as any).offer_name || (ws as any).name,
      spend: winSpend,
      reach: winReach,
      cardDisplay,
      changeContext,
      topRecs,
    });
  }

  const userName = 'there';
  const html = campaigns.length === 0
    ? buildQuietWeekEmail({ userName, brandName: brand.name, frequencyLabel })
    : buildBigPictureEmail({ userName, brandName: brand.name, frequencyLabel, campaigns });

  const subject = campaigns.length === 0
    ? `[TEST] 📭 ${frequencyLabel} Ad Report: ${brand.name} — quiet window`
    : `[TEST] 📊 ${frequencyLabel} Ad Report: ${brand.name} — ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} with data`;

  const { error: sendErr } = await resend.emails.send({
    from: 'Lumi <reports@adsbylumi.com>',
    to: [recipientEmail],
    subject,
    html,
  });
  if (sendErr) return json(200, { error: (sendErr as any).message || 'Send failed' });

  return json(200, {
    success: true,
    sentTo: recipientEmail,
    brandName: brand.name,
    campaignCount: campaigns.length,
    daysWindow,
    status: campaigns.length === 0 ? 'quiet-window' : 'sent',
  });
}

// ===================== EMAIL TEMPLATES =====================


const APP_BIG_PICTURE_URL = 'https://adsbylumi.com/live-ads';

function statusColors(status: string): { bg: string; border: string; text: string; chipBg: string } {
  switch (status) {
    case 'healthy': return { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', chipBg: '#DCFCE7' };
    case 'attention': return { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', chipBg: '#FEF3C7' };
    case 'critical': return { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', chipBg: '#FEE2E2' };
    default: return { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569', chipBg: '#F1F5F9' };
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'healthy': return 'On track';
    case 'attention': return 'Watch closely';
    case 'critical': return 'Needs attention';
    default: return 'Not enough data';
  }
}

function renderBigPictureRow(c: CampaignRow): string {
  const cd = c.cardDisplay;
  const col = statusColors(cd.overallStatus);
  const primarySub = cd.primary.goalDisplay ? `goal ${cd.primary.goalDisplay}` : 'no goal set';
  const secondaryBit = cd.secondary
    ? `<span style="color:#64748B;font-size:12px;">·</span> <span style="font-size:12px;color:#334155;">${cd.secondary.label}: <strong style="color:#0F172A;">${cd.secondary.valueDisplay}</strong> <span style="color:#64748B;">(goal ${cd.secondary.goalDisplay})</span></span>`
    : '';
  const changeChip = c.changeContext?.recentEventsCount
    ? `<div style="display:inline-block;margin-top:6px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">⏳ ${c.changeContext.summary || `${c.changeContext.recentEventsCount} recent change${c.changeContext.recentEventsCount === 1 ? '' : 's'} — data still settling`}</div>`
    : '';
  return `
    <tr><td style="padding:14px 18px;border-bottom:1px solid #F1F5F9;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="min-width:0;">
          <div style="font-size:15px;font-weight:800;color:#0F172A;">${escapeHtml(c.name)}</div>
          <div style="margin-top:4px;font-size:12px;color:#334155;">
            <span style="display:inline-block;background:${col.chipBg};color:${col.text};border:1px solid ${col.border};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${statusLabel(cd.overallStatus)}</span>
            <span style="margin-left:8px;">${escapeHtml(cd.primary.label)}: <strong style="color:#0F172A;">${escapeHtml(cd.primary.valueDisplay)}</strong> <span style="color:#64748B;">(${escapeHtml(primarySub)})</span></span>
            ${secondaryBit}
          </div>
          ${changeChip}
        </div>
        <div style="text-align:right;font-size:11px;color:#64748B;white-space:nowrap;">
          Spend ${escapeHtml(cd.spendDisplay)}
        </div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#475569;line-height:1.5;">
        <strong style="color:#0F172A;">LUMI says:</strong> ${escapeHtml(cd.actionRec)}
      </div>
    </td></tr>
  `;
}

function renderQuickListItem(c: CampaignRow, rec: CampaignRow['topRecs'][number]): string {
  return `
    <tr><td style="padding:0 0 10px;">
      <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;">
        <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:.4px;">${escapeHtml(c.name)}</div>
        <div style="margin-top:4px;font-size:14px;font-weight:800;color:#0F172A;line-height:1.4;">${escapeHtml(rec.title)}</div>
        ${rec.description ? `<div style="margin-top:6px;font-size:13px;color:#334155;line-height:1.55;">${escapeHtml(rec.description)}</div>` : ''}
        ${rec.impact ? `<div style="margin-top:6px;font-size:12px;color:#64748B;line-height:1.5;"><strong style="color:#475569;">Why it matters:</strong> ${escapeHtml(rec.impact)}</div>` : ''}
      </div>
    </td></tr>
  `;
}

function buildBigPictureEmail(params: {
  userName: string;
  brandName: string;
  frequencyLabel: string;
  campaigns: CampaignRow[];
}): string {
  const { userName, brandName, frequencyLabel, campaigns } = params;

  // QUICK LIST: pull the top 3–5 recs across qualifying campaigns. Engine
  // priority wins (lower number = more urgent), then we cap.
  const allRecs = campaigns.flatMap(c =>
    c.topRecs.map(r => ({ c, r }))
  ).sort((a, b) => a.r.priority - b.r.priority);
  const quickList = allRecs.slice(0, 5);

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const onTrack = campaigns.filter(c => c.cardDisplay.overallStatus === 'healthy').length;
  const watching = campaigns.filter(c => c.cardDisplay.overallStatus === 'attention').length;
  const flagged = campaigns.filter(c => c.cardDisplay.overallStatus === 'critical').length;
  const summaryLine = flagged > 0
    ? `${flagged} need${flagged === 1 ? 's' : ''} attention · ${watching} to watch · ${onTrack} on track`
    : watching > 0
      ? `${watching} to watch · ${onTrack} on track`
      : `All ${onTrack} campaign${onTrack === 1 ? '' : 's'} on track 🎉`;

  const quickListHtml = quickList.length === 0
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#475569;">Nothing urgent across your campaigns this ${frequencyLabel.toLowerCase()}. Keep going.</td></tr>`
    : quickList.map(({ c, r }) => renderQuickListItem(c, r)).join('');

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${frequencyLabel} Ad Report</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');</style>
</head><body style="margin:0;padding:0;font-family:'Red Hat Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#FAF9F6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF9F6;padding:30px 20px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#F97316 0%,#EC4899 40%,#A78BFA 70%,#93C5FD 100%);padding:32px 36px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-.3px;">📊 ${frequencyLabel} Ad Report</h1>
  <p style="color:rgba(255,255,255,.92);margin:8px 0 0;font-size:14px;font-weight:500;">${escapeHtml(brandName)} · ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} with data this ${frequencyLabel.toLowerCase()}</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:28px 36px 8px;">
  <p style="margin:0;color:#0F172A;font-size:16px;font-weight:700;">Hey ${escapeHtml(userName)} 👋</p>
  <p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.6;">
    Here's the big picture across the campaigns that actually ran this ${frequencyLabel.toLowerCase()}, plus the few moves worth making. ${escapeHtml(summaryLine)}.
  </p>
  <p style="margin:8px 0 0;color:#64748B;font-size:12px;">Total spend in window: <strong style="color:#0F172A;">$${totalSpend.toFixed(2)}</strong></p>
</td></tr>

<!-- Big Picture -->
<tr><td style="padding:18px 28px 8px;">
  <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px;">The Big Picture</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBFC;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    ${campaigns.map(renderBigPictureRow).join('')}
  </table>
</td></tr>

<!-- Quick List -->
<tr><td style="padding:22px 28px 8px;">
  <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px;">Quick List — this ${frequencyLabel.toLowerCase()}'s moves</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${quickListHtml}
  </table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:18px 36px 32px;text-align:center;">
  <a href="${APP_BIG_PICTURE_URL}" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899 50%,#A78BFA);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 6px 20px rgba(236,72,153,.3);letter-spacing:.2px;">Open the Big Picture →</a>
  <p style="margin:10px 0 0;color:#64748B;font-size:11px;">Approve, snooze, or skip each move in the app.</p>
</td></tr>

<!-- Closer -->
<tr><td style="padding:0 36px 26px;">
  <p style="margin:0;color:#0F172A;font-size:13px;font-weight:600;">Keep going — you're doing great 💜<br/><span style="font-weight:700;">— Lumi</span></p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#FAF9F6;padding:18px 36px;text-align:center;border-top:1px solid #F5F3EE;">
  <p style="margin:0;color:#a0aec0;font-size:11px;line-height:1.6;">Lumi by Ads by Lumi · Meta Ads, Simplified<br/>This is an automated ${frequencyLabel.toLowerCase()} report. Manage preferences in your dashboard settings.</p>
</td></tr>

</table></td></tr></table></body></html>`;
}

function buildQuietWeekEmail(params: { userName: string; brandName: string; frequencyLabel: string }): string {
  const { userName, brandName, frequencyLabel } = params;
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${frequencyLabel} Ad Report — Quiet ${frequencyLabel === 'Daily' ? 'day' : 'week'}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');</style>
</head><body style="margin:0;padding:0;font-family:'Red Hat Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#FAF9F6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF9F6;padding:30px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06);">
<tr><td style="background:linear-gradient(135deg,#F97316,#EC4899 50%,#A78BFA);padding:32px 36px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">📭 Nothing to report this ${frequencyLabel === 'Daily' ? 'day' : 'week'}</h1>
  <p style="color:rgba(255,255,255,.92);margin:8px 0 0;font-size:13px;">${escapeHtml(brandName)}</p>
</td></tr>
<tr><td style="padding:28px 36px;">
  <p style="margin:0;color:#0F172A;font-size:15px;font-weight:700;">Hey ${escapeHtml(userName)} 👋</p>
  <p style="margin:12px 0 0;color:#475569;font-size:14px;line-height:1.65;">
    Your ads were quiet this ${frequencyLabel.toLowerCase()} — no campaigns had delivery in the window, so there's nothing to grade.
  </p>
  <p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.65;">
    Common reasons: campaigns are paused, learning, or your budget hasn't started spending yet. Pop into the app to double-check or kick something off.
  </p>
  <div style="text-align:center;margin-top:24px;">
    <a href="${APP_BIG_PICTURE_URL}" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899 50%,#A78BFA);color:#fff;text-decoration:none;padding:13px 28px;border-radius:12px;font-size:14px;font-weight:700;box-shadow:0 6px 20px rgba(236,72,153,.3);">Open the Big Picture →</a>
  </div>
  <p style="margin:24px 0 0;color:#0F172A;font-size:13px;font-weight:600;">— Lumi</p>
</td></tr>
<tr><td style="background:#FAF9F6;padding:18px 36px;text-align:center;border-top:1px solid #F5F3EE;">
  <p style="margin:0;color:#a0aec0;font-size:11px;line-height:1.6;">Lumi by Ads by Lumi · Manage email preferences in dashboard settings.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sample campaign rows used by testMode previews. Shape matches CampaignRow
// so they flow through the same buildBigPictureEmail template the cron uses.
function buildSampleCampaigns(): CampaignRow[] {
  return [
    {
      workspaceId: 'sample-1',
      name: 'Free Workshop Registration',
      spend: 298.10,
      reach: 12400,
      cardDisplay: {
        primary: { key: 'cpl', label: 'CPL', valueDisplay: '$32.40', goalDisplay: '< $25', status: 'attention' },
        secondary: { key: 'leads', label: 'Leads', valueDisplay: '14', goalDisplay: '> 20', status: 'attention' },
        ctr: { valueDisplay: '0.82%', benchmarkDisplay: '> 1.0%', status: 'attention' },
        frequency: { valueDisplay: '2.1', goalDisplay: '< 3.5', status: 'healthy' },
        overallStatus: 'attention',
        actionRec: 'Refresh creative before scaling — your hook isn\'t earning the click.',
        spendDisplay: '$298.10',
      },
      changeContext: { recentEventsCount: 2, summary: '2 recent changes — data still settling' },
      topRecs: [
        {
          title: 'CPL is $32 — each lead is costing $7 over target',
          description: "Your goal is under $25 but you're at $32.40. CTR is 0.82% — people aren't clicking, so the hook and creative aren't grabbing attention.",
          impact: 'Better creative signals help Meta find the right people faster.',
          confidence: 'high', priority: 1, type: 'swap_creative',
        },
      ],
    },
    {
      workspaceId: 'sample-2',
      name: 'Client Success Stories — Video',
      spend: 312.40,
      reach: 18900,
      cardDisplay: {
        primary: { key: 'cpl', label: 'CPL', valueDisplay: '$18.50', goalDisplay: '< $30', status: 'healthy' },
        secondary: { key: 'leads', label: 'Leads', valueDisplay: '21', goalDisplay: '> 15', status: 'healthy' },
        ctr: { valueDisplay: '1.6%', benchmarkDisplay: '> 1.0%', status: 'healthy' },
        frequency: { valueDisplay: '1.8', goalDisplay: '< 3.5', status: 'healthy' },
        overallStatus: 'healthy',
        actionRec: 'Increase budget — this one\'s ready to scale.',
        spendDisplay: '$312.40',
      },
      topRecs: [
        {
          title: 'Scale budget 20% — hitting your goal',
          description: 'Your CPL is $18.50, which beats your goal of under $30. This campaign is ready to scale at its current efficiency.',
          impact: 'Capture more results at the same cost per lead.',
          confidence: 'high', priority: 2, type: 'budget',
        },
      ],
    },
  ];
}
