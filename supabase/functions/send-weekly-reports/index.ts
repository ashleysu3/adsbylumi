import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface NotificationPrefs {
  report_frequency?: 'off' | 'daily' | 'weekly';
  critical_alerts?: boolean;
  performance_drops?: boolean;
  last_report_sent_at?: string;
  weekly_digest?: boolean;
}

interface CampaignSummary {
  workspaceId: string;
  name: string;
  spend: number;
  primaryKpiLabel: string;
  primaryKpiValue: string;
  primaryKpiGoal: string;
  results: number;
  resultsLabel: string;
  statusEmoji: string;
  statusNote: string;
  frequency: number;
  isFatigued: boolean;
  fatigueSuggestion: string;
  dailyBudget: number | null;
  whatsHappening: string;
  lumiRecommends: string;
  todoItems: string[];
  approveItems: string[];
  // Raw data carried into the post-campaigns loop so we can fetch live recs
  // from generate-recommendations and mint structured approval tokens that
  // approve-from-email can actually execute.
  metrics?: Record<string, any>;
  adMetrics?: any[];
  goals?: any;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting consolidated performance report email job...');

    const today = new Date();
    const dayOfWeek = today.getUTCDay();

    const { data: workspaces, error: workspacesError } = await supabase
      .from('campaign_workspaces')
      .select(`
        id, name, brand_id, meta_campaign_ids, performance_report_latest,
        performance_history, offer_name, campaign_builder_answers,
        brands!inner(id, user_id, name, notification_preferences),
        campaign_goals(primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type)
      `)
      .not('meta_campaign_ids', 'is', null)
      .eq('archived', false);

    if (workspacesError) throw workspacesError;

    console.log(`Found ${workspaces?.length || 0} published workspaces`);

    // Group workspaces by BRAND (not by user). Agency users own multiple
    // brands (one per client); each client needs its own email with a
    // subject that matches the brand and content scoped to that brand's
    // campaigns only. The previous user_id grouping lumped every client's
    // campaigns into one email tagged with whichever brand happened to be
    // seen first — bad UX for agencies.
    const brandGroups = new Map<string, { brand: any; workspaces: any[] }>();

    for (const ws of workspaces || []) {
      const brand = ws.brands as any;
      const brandId = brand.id;
      if (!brandGroups.has(brandId)) {
        brandGroups.set(brandId, { brand, workspaces: [] });
      }
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
        if (!prefs.report_frequency && prefs.weekly_digest === false) {
          reportFrequency = 'off';
        }

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
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single();

        if (!profile?.email) {
          results.push({ brandId, userId, email: '', status: 'skipped', error: 'No email', campaignCount: group.workspaces.length });
          continue;
        }

        // Build campaign summaries from stored reports
        const campaigns: CampaignSummary[] = [];

        for (const ws of group.workspaces) {
          const history = ws.performance_history || [];
          const latestSnapshot = history[history.length - 1];
          const metrics = latestSnapshot?.metrics || {};
          const report = ws.performance_report_latest;
          const reportText = (report as any)?.report_text || '';

          const frequency = metrics.frequency || 0;
          const spend = metrics.spend || 0;
          const isFatigued = frequency >= 3.5;
          const dailyBudget = (ws.campaign_builder_answers as any)?.budget || null;

          // Determine primary KPI display
          const goals = (ws.campaign_goals as any)?.[0];
          let primaryKpiLabel = goals?.primary_kpi_label || 'Results';
          let primaryKpiValue = '—';
          let primaryKpiGoal = '';

          // Determine results count
          let resultsCount = 0;
          let resultsLabel = 'results';

          if (goals) {
            const kpiKey = goals.primary_kpi;
            const val = metrics[kpiKey];
            if (val !== undefined && val !== null) {
              primaryKpiValue = kpiKey.includes('roas') ? `${Number(val).toFixed(1)}x` : `$${Number(val).toFixed(2)}`;
            }
            const goalType = goals.primary_kpi_goal_type === 'less_than' ? '<' : '>';
            const threshold = goals.primary_kpi_threshold;
            primaryKpiGoal = `${goalType} ${kpiKey.includes('roas') ? `${threshold}x` : `$${threshold}`}`;

            if (kpiKey.includes('lead') || kpiKey === 'cpl') {
              resultsCount = metrics.leads || 0;
              resultsLabel = 'leads';
            } else if (kpiKey.includes('purchase') || kpiKey === 'cpp') {
              resultsCount = metrics.purchases || 0;
              resultsLabel = 'sales';
            }
          } else {
            const cplOrCpp = metrics.cpl || metrics.cpp;
            if (cplOrCpp) {
              primaryKpiLabel = metrics.cpl ? 'CPL' : 'CPP';
              primaryKpiValue = `$${Number(cplOrCpp).toFixed(2)}`;
            }
            resultsCount = metrics.leads || metrics.purchases || 0;
            resultsLabel = metrics.leads ? 'leads' : 'results';
          }

          // Status determination
          let statusEmoji = '✅';
          let statusNote = 'On track';

          if (report) {
            const hasRedKpi = Object.values((report as any).kpi_evaluation || {}).some((kpi: any) => kpi?.status === 'critical');
            const hasYellowKpi = Object.values((report as any).kpi_evaluation || {}).some((kpi: any) => kpi?.status === 'attention');

            if (hasRedKpi) {
              statusEmoji = '⚠️';
              statusNote = 'Needs attention';
            } else if (hasYellowKpi || isFatigued) {
              statusEmoji = '⚠️';
              statusNote = isFatigued ? 'Creative fatigue detected' : 'Monitor closely';
            }
          }

          if (!report && !latestSnapshot) {
            statusEmoji = '⏸️';
            statusNote = 'No data yet';
          }

          // Parse sections from stored report text
          const whatsHappening = extractSection(reportText, "What's Happening");
          const lumiRecommends = extractSection(reportText, '✦ LUMI Recommends') || extractSection(reportText, 'LUMI Recommends');
          const todoItems = extractChecklist(reportText, 'Your To-Do List');
          const approveItems = extractChecklist(reportText, 'Approve These Changes');

          // Creative fatigue suggestion — NO landing page or retargeting advice
          let fatigueSuggestion = '';
          if (isFatigued) {
            const ctr = metrics.ctr || 0;
            const roas = metrics.roas || 0;
            if (ctr > 1.5) {
              fatigueSuggestion = 'Your hooks are strong — try a new variation of your best-performing opening with a different visual backdrop.';
            } else if (roas >= 2) {
              fatigueSuggestion = 'Your offer converts well — film a testimonial-style ad or try a talking-head script with the same key benefit.';
            } else if (frequency >= 5) {
              fatigueSuggestion = 'Audience is seeing ads too often — reshoot your best concept in a new setting or create a 15-second cut-down for Stories/Reels.';
            } else {
              fatigueSuggestion = 'Time for fresh creative — try a pattern-interrupt hook or a casual selfie-style testimonial ad.';
            }
          }

          campaigns.push({
            workspaceId: ws.id,
            name: ws.offer_name || ws.name,
            spend,
            primaryKpiLabel,
            primaryKpiValue,
            primaryKpiGoal,
            results: resultsCount,
            resultsLabel,
            statusEmoji,
            statusNote,
            frequency,
            isFatigued,
            fatigueSuggestion,
            dailyBudget,
            whatsHappening,
            lumiRecommends,
            todoItems,
            approveItems,
            // Passed through for the structured-approval-tokens pass below.
            metrics: { ...metrics, dailyBudget },
            adMetrics: latestSnapshot?.adMetrics || [],
            goals: goals || null,
          });
        }

        const userName = profile.full_name || 'there';
        const frequencyLabel = reportFrequency === 'daily' ? 'Daily' : 'Weekly';

        // Generate approval tokens. Two passes:
        //   1) LEGACY: narrative items parsed from "Approve These Changes"
        //      in the stored report text. No structured action data, so
        //      approve-from-email will mark them as "recorded, apply manually
        //      in LUMI" on click. Kept for backward compat until we fully
        //      migrate to rec-engine-driven emails in Phase 2.
        //   2) STRUCTURED: live from generate-recommendations per campaign.
        //      These carry full actionType + actionPayload so approve-from-
        //      email can dispatch them to Meta directly. These are the ones
        //      that actually "work" end-to-end after patch #7.
        const approvalTokens: { description: string; url: string }[] = [];

        // Pass 1: legacy narrative approvals.
        for (const c of campaigns) {
          for (const item of c.approveItems) {
            const { data: tokenRow } = await supabase.from('email_approval_tokens').insert({
              user_id: userId,
              brand_id: brand.id,
              workspace_id: c.workspaceId,
              action_description: item,
              action_data: { source: 'weekly_report', campaign: c.name },
            }).select('token').single();

            if (tokenRow) {
              approvalTokens.push({
                // Include the campaign name so users can tell which item
                // is which when the rec engine generates similar-looking
                // titles across campaigns (e.g. multiple "Strong ROAS —
                // ready to scale" recs with no campaign disambiguation).
                description: `${item} — ${c.name}`,
                url: `${supabaseUrl}/functions/v1/approve-from-email?token=${tokenRow.token}`,
              });
            }
          }
        }

        // Pass 2: structured approvals from live rec engine output.
        const ACTIONABLE_REC_TYPES = new Set([
          'pause_ad', 'resume_ad',
          'budget_increase', 'budget_decrease',
          'swap_creative', 'promote_to_scaling',
        ]);
        const MAX_STRUCTURED_PER_CAMPAIGN = 2; // keep the email tight
        for (const c of campaigns) {
          try {
            const { data: recsResp, error: recsErr } = await supabase.functions.invoke(
              'generate-recommendations',
              {
                body: {
                  workspaceId: c.workspaceId,
                  brandId: brand.id,
                  metrics: c.metrics,
                  ads: c.adMetrics,
                  goals: c.goals,
                },
              },
            );
            if (recsErr || !recsResp?.recommendations) continue;

            const actionable = (recsResp.recommendations as any[])
              .filter(r => ACTIONABLE_REC_TYPES.has(r.type))
              .slice(0, MAX_STRUCTURED_PER_CAMPAIGN);

            for (const rec of actionable) {
              const { data: tokenRow } = await supabase
                .from('email_approval_tokens')
                .insert({
                  user_id: userId,
                  brand_id: brand.id,
                  workspace_id: c.workspaceId,
                  action_description: rec.title,
                  action_data: {
                    source: 'weekly_report',
                    campaign: c.name,
                    actionType: rec.type,
                    actionPayload: rec.actionPayload || {},
                    recDescription: rec.description || '',
                    confidence: rec.confidence || 'medium',
                  },
                })
                .select('token')
                .single();

              if (tokenRow) {
                approvalTokens.push({
                  // Same fix as the legacy pass above: prepend/append the
                  // campaign name so clicking "Approve" on an email button
                  // tells the user which campaign is affected.
                  description: `${rec.title} — ${c.name}`,
                  url: `${supabaseUrl}/functions/v1/approve-from-email?token=${tokenRow.token}`,
                });
              }
            }
          } catch (err) {
            console.error(`Failed to fetch recs for workspace ${c.workspaceId}:`, err);
          }
        }

        const emailHtml = buildConsolidatedEmail({
          userName,
          brandName: brand.name,
          frequencyLabel,
          campaigns,
          approvalTokens,
          supabaseUrl,
        });

        const { error: emailError } = await resend.emails.send({
          from: 'Lumi <reports@adsbylumi.com>',
          to: [profile.email],
          subject: `📊 ${frequencyLabel} Ad Report: ${brand.name} — ${campaigns.length} Campaign${campaigns.length !== 1 ? 's' : ''}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Email failed for user ${userId}:`, emailError);
          results.push({ brandId, userId, email: profile.email, status: 'error', error: (emailError as any).message, campaignCount: campaigns.length });
        } else {
          console.log(`Consolidated email sent to ${profile.email} (${campaigns.length} campaigns)`);
          const updatedPrefs = { ...prefs, report_frequency: reportFrequency, last_report_sent_at: today.toISOString() };
          await supabase.from('brands').update({ notification_preferences: updatedPrefs }).eq('id', brand.id);
          results.push({ brandId, userId, email: profile.email, status: 'sent', campaignCount: campaigns.length });
        }
      } catch (userError: any) {
        console.error(`Error processing user ${userId}:`, userError);
        results.push({ brandId, userId, email: '', status: 'error', error: userError.message, campaignCount: group.workspaces.length });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`Consolidated reports complete: ${sentCount} sent, ${errorCount} errors`);

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

    return new Response(JSON.stringify({ success: true, summary: { users: userGroups.size, sent: sentCount, errors: errorCount }, results }), {
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

// ========== HELPERS ==========

function extractSection(reportText: string, sectionName: string): string {
  if (!reportText) return '';
  const regex = new RegExp(`\\*\\*(?:✦\\s*)?${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:?\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|\\n---|\\n###|$)`, 'i');
  const match = reportText.match(regex);
  return match ? match[1].trim().substring(0, 500) : '';
}

function extractChecklist(reportText: string, sectionName: string): string[] {
  if (!reportText) return [];
  const regex = new RegExp(`###.*${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n---|\\n###|$)`, 'i');
  const match = reportText.match(regex);
  if (!match) return [];
  const items: string[] = [];
  const lines = match[0].split('\n');
  for (const line of lines) {
    const itemMatch = line.match(/^-\s*\[[ x]\]\s*(.+)/i);
    if (itemMatch) items.push(itemMatch[1].trim());
  }
  return items;
}

// ========== EMAIL TEMPLATE ==========

function buildConsolidatedEmail(params: {
  userName: string;
  brandName: string;
  frequencyLabel: string;
  campaigns: CampaignSummary[];
  approvalTokens: { description: string; url: string }[];
  supabaseUrl: string;
}): string {
  const { userName, brandName, frequencyLabel, campaigns, approvalTokens } = params;

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const onTrack = campaigns.filter(c => c.statusEmoji === '✅').length;
  const needsAttention = campaigns.filter(c => c.statusEmoji === '⚠️').length;
  const fatiguedCampaigns = campaigns.filter(c => c.isFatigued);
  const totalDailyBudget = campaigns.reduce((sum, c) => sum + (c.dailyBudget || 0), 0);

  // All to-do items across campaigns
  const allTodoItems = campaigns.flatMap(c => c.todoItems.map(item => ({ campaign: c.name, workspaceId: c.workspaceId, item })));

  const summaryText = needsAttention > 0
    ? `${onTrack} on track · ${needsAttention} need${needsAttention !== 1 ? '' : 's'} attention`
    : `All ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} on track 🎉`;

  // Campaign rows
  const campaignRowsHtml = campaigns.map(c => `
    <tr><td style="padding:20px;border-bottom:1px solid #F1F5F9;">
      <p style="margin:0;font-size:16px;font-weight:800;color:#111;">${c.statusEmoji} ${c.name}</p>
      <p style="margin:4px 0 12px;font-size:12px;color:#64748B;">${c.statusNote}</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="33%" style="text-align:center;padding:4px;">
          <div style="background:#F8FAFC;border-radius:8px;padding:10px 6px;">
            <p style="margin:0;font-size:10px;color:#64748B;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">Ad Spend</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#111;">$${c.spend.toFixed(2)}</p>
          </div>
        </td>
        <td width="33%" style="text-align:center;padding:4px;">
          <div style="background:#F8FAFC;border-radius:8px;padding:10px 6px;">
            <p style="margin:0;font-size:10px;color:#64748B;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">${c.primaryKpiLabel}</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#111;">${c.primaryKpiValue}</p>
            ${c.primaryKpiGoal ? `<p style="margin:2px 0 0;font-size:11px;color:#64748B;">Goal: ${c.primaryKpiGoal}</p>` : ''}
          </div>
        </td>
        <td width="33%" style="text-align:center;padding:4px;">
          <div style="background:#F8FAFC;border-radius:8px;padding:10px 6px;">
            <p style="margin:0;font-size:10px;color:#64748B;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">Results</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#111;">${c.results}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#64748B;">${c.resultsLabel}</p>
          </div>
        </td>
      </tr></table>
      ${c.whatsHappening ? `
      <div style="margin-top:14px;padding:12px 16px;background:#FAFBFC;border-radius:10px;border:1px solid #E2E8F0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px;">What's Happening</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${c.whatsHappening.substring(0, 300)}</p>
      </div>` : ''}
      ${c.lumiRecommends ? `
      <div style="margin-top:10px;padding:12px 16px;background:linear-gradient(135deg,#FFF7ED,#FFEDD5);border-radius:10px;border:1px solid #FED7AA;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#9A3412;text-transform:uppercase;letter-spacing:.5px;">✦ LUMI Recommends</p>
        <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">${c.lumiRecommends.substring(0, 300)}</p>
      </div>` : ''}
    </td></tr>
  `).join('');

  // Budget overview
  const budgetRowsHtml = campaigns.filter(c => c.dailyBudget).map(c => `
    <tr>
      <td style="padding:8px 16px;font-size:13px;color:#374151;border-bottom:1px solid #F1F5F9;">${c.name}</td>
      <td style="padding:8px 16px;font-size:13px;color:#374151;border-bottom:1px solid #F1F5F9;text-align:right;">~$${c.dailyBudget?.toFixed(0)}/day</td>
    </tr>
  `).join('');

  const budgetHtml = budgetRowsHtml ? `
    <tr><td style="padding:0 30px 20px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px;">💰 Budget Overview</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBFC;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
        ${budgetRowsHtml}
        <tr>
          <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#111;">Total</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#111;text-align:right;">~$${totalDailyBudget.toFixed(0)}/day</td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-size:12px;color:#64748B;">Total Ad Spend: <strong>$${totalSpend.toFixed(2)}</strong></p>
    </td></tr>
  ` : '';

  // To-do list
  const todoHtml = allTodoItems.length > 0 ? `
    <tr><td style="padding:0 30px 20px;">
      <div style="background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-radius:12px;padding:20px;border:1px solid #BFDBFE;">
        <p style="margin:0 0 12px;font-size:16px;font-weight:800;color:#1E40AF;">📋 Your To-Do List</p>
        ${allTodoItems.map(t => `
          <div style="background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:8px;border:1px solid #BFDBFE;">
            <p style="margin:0;font-size:13px;color:#1E3A5F;line-height:1.5;">${t.item}</p>
            <a href="https://adsbylumi.com/creative-studio?workspace=${t.workspaceId}&refreshCreative=true" style="display:inline-block;margin-top:8px;background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;">Get Started →</a>
          </div>
        `).join('')}
      </div>
    </td></tr>
  ` : '';

  // Approve changes
  const approveHtml = approvalTokens.length > 0 ? `
    <tr><td style="padding:0 30px 20px;">
      <div style="background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border-radius:12px;padding:20px;border:1px solid #BBF7D0;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:800;color:#166534;">🤝 Approve These Changes</p>
        <p style="margin:0 0 14px;font-size:13px;color:#15803D;">Click to approve — LUMI will handle the rest.</p>
        ${approvalTokens.map(t => `
          <div style="background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:8px;border:1px solid #BBF7D0;">
            <p style="margin:0;font-size:13px;color:#1E3A5F;line-height:1.5;">${t.description}</p>
            <a href="${t.url}" style="display:inline-block;margin-top:8px;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;">Approve ✅</a>
          </div>
        `).join('')}
      </div>
    </td></tr>
  ` : '';

  // Fatigue section
  const fatigueHtml = fatiguedCampaigns.length > 0 ? `
    <tr><td style="padding:0 30px 20px;">
      <div style="background:linear-gradient(135deg,#FFFBEB,#FEF3C7);border-radius:12px;padding:20px;border:1px solid #FDE68A;">
        <p style="margin:0;font-size:16px;font-weight:800;color:#92400E;">🔄 Creative Refresh Needed</p>
        <p style="margin:6px 0 16px;font-size:13px;color:#B45309;">These campaigns have high frequency — your audience is seeing the same ads too often.</p>
        ${fatiguedCampaigns.map(c => `
          <div style="background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:10px;border:1px solid #FDE68A;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#111;">⚠️ ${c.name} <span style="font-weight:500;color:#B45309;font-size:12px;">(Frequency: ${c.frequency.toFixed(1)})</span></p>
            <p style="margin:8px 0 12px;font-size:13px;color:#4a5568;line-height:1.6;">💡 ${c.fatigueSuggestion}</p>
            <a href="https://adsbylumi.com/creative-studio?workspace=${c.workspaceId}&refreshCreative=true" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EA580C);color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;">Refresh Creative →</a>
          </div>
        `).join('')}
      </div>
    </td></tr>
  ` : '';

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${frequencyLabel} Ad Report</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');</style>
</head><body style="margin:0;padding:0;font-family:'Red Hat Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#FAF9F6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF9F6;padding:30px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#F97316 0%,#EC4899 40%,#A78BFA 70%,#93C5FD 100%);padding:35px 40px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:-.5px;">📊 ${frequencyLabel} Performance Report</h1>
  <p style="color:rgba(255,255,255,.9);margin:10px 0 0;font-size:15px;font-weight:500;">${brandName} · ${campaigns.length} Campaign${campaigns.length !== 1 ? 's' : ''}</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:35px 40px 10px;">
  <p style="margin:0;color:#111;font-size:17px;font-weight:600;">Hey ${userName} 👋</p>
  <p style="margin:12px 0 0;color:#4a5568;font-size:15px;line-height:1.7;">Here's your ${frequencyLabel.toLowerCase()} snapshot across all your campaigns.</p>
</td></tr>

<!-- Summary -->
<tr><td style="padding:16px 30px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="50%" style="padding:6px;">
      <div style="background:linear-gradient(135deg,#FFF7ED,#FFEDD5);border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;color:#9A3412;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">Total Spend</p>
        <p style="margin:4px 0 0;color:#111;font-size:24px;font-weight:800;">$${totalSpend.toFixed(2)}</p>
      </div>
    </td>
    <td width="50%" style="padding:6px;">
      <div style="background:linear-gradient(135deg,${needsAttention > 0 ? '#FFFBEB,#FEF3C7' : '#F0FDF4,#DCFCE7'});border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;color:${needsAttention > 0 ? '#92400E' : '#166534'};font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">Status</p>
        <p style="margin:4px 0 0;color:#111;font-size:14px;font-weight:700;">${summaryText}</p>
      </div>
    </td>
  </tr></table>
</td></tr>

<!-- Campaign Breakdown -->
<tr><td style="padding:0 30px 10px;">
  <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px;">Campaign Breakdown</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBFC;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    ${campaignRowsHtml}
  </table>
</td></tr>

${budgetHtml}
${fatigueHtml}
${todoHtml}
${approveHtml}

<!-- CTA -->
<tr><td style="padding:10px 40px 35px;text-align:center;">
  <a href="https://adsbylumi.com/ad-performance" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899 50%,#A78BFA);color:#fff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 6px 20px rgba(236,72,153,.3);letter-spacing:.3px;">View Full Report →</a>
</td></tr>

<!-- Closer -->
<tr><td style="padding:0 40px 30px;">
  <p style="margin:0;color:#111;font-size:14px;font-weight:600;">Keep going — you're doing amazing 💜<br/><span style="font-weight:700;">— Lumi</span></p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#FAF9F6;padding:22px 40px;text-align:center;border-top:1px solid #F5F3EE;">
  <p style="margin:0;color:#a0aec0;font-size:11px;line-height:1.6;">Lumi by Ads by Lumi · Meta Ads, Simplified<br/>This is an automated ${frequencyLabel.toLowerCase()} report. Manage preferences in your dashboard settings.</p>
</td></tr>

</table></td></tr></table></body></html>`;
}
