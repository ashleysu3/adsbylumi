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
  statusEmoji: string;
  statusNote: string;
  frequency: number;
  isFatigued: boolean;
  fatigueSuggestion: string;
  ctr: number;
  roas: number;
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

    // Fetch all published, non-archived workspaces with brand + goals
    const { data: workspaces, error: workspacesError } = await supabase
      .from('campaign_workspaces')
      .select(`
        id, name, brand_id, meta_campaign_ids, performance_report_latest,
        performance_history, offer_name,
        brands!inner(id, user_id, name, notification_preferences),
        campaign_goals(primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type)
      `)
      .not('meta_campaign_ids', 'is', null)
      .eq('archived', false);

    if (workspacesError) throw workspacesError;

    console.log(`Found ${workspaces?.length || 0} published workspaces`);

    // Group workspaces by user_id
    const userGroups = new Map<string, {
      brand: any;
      workspaces: any[];
    }>();

    for (const ws of workspaces || []) {
      const brand = ws.brands as any;
      const userId = brand.user_id;

      if (!userGroups.has(userId)) {
        userGroups.set(userId, { brand, workspaces: [] });
      }
      userGroups.get(userId)!.workspaces.push(ws);
    }

    console.log(`Grouped into ${userGroups.size} users`);

    const results: { userId: string; email: string; status: string; error?: string; campaignCount: number }[] = [];

    for (const [userId, group] of userGroups) {
      try {
        const { brand } = group;
        const prefs: NotificationPrefs = brand.notification_preferences || {};

        // Determine frequency
        let reportFrequency: 'off' | 'daily' | 'weekly' = prefs.report_frequency || 'weekly';
        if (!prefs.report_frequency && prefs.weekly_digest === false) {
          reportFrequency = 'off';
        }

        if (reportFrequency === 'off') {
          results.push({ userId, email: '', status: 'skipped', error: 'Reports disabled', campaignCount: group.workspaces.length });
          continue;
        }

        const lastSent = prefs.last_report_sent_at ? new Date(prefs.last_report_sent_at) : null;

        // Weekly: only on Mondays
        if (reportFrequency === 'weekly') {
          if (dayOfWeek !== 1) {
            results.push({ userId, email: '', status: 'skipped', error: 'Not Monday', campaignCount: group.workspaces.length });
            continue;
          }
          if (lastSent && (today.getTime() - lastSent.getTime()) < 7 * 24 * 60 * 60 * 1000) {
            results.push({ userId, email: '', status: 'skipped', error: 'Already sent this week', campaignCount: group.workspaces.length });
            continue;
          }
        }

        // Daily: skip if already sent today
        if (reportFrequency === 'daily') {
          if (lastSent && lastSent.toDateString() === today.toDateString()) {
            results.push({ userId, email: '', status: 'skipped', error: 'Already sent today', campaignCount: group.workspaces.length });
            continue;
          }
        }

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single();

        if (!profile?.email) {
          results.push({ userId, email: '', status: 'skipped', error: 'No email', campaignCount: group.workspaces.length });
          continue;
        }

        // Build campaign summaries
        const campaigns: CampaignSummary[] = [];

        for (const ws of group.workspaces) {
          const history = ws.performance_history || [];
          const latestSnapshot = history[history.length - 1];
          const metrics = latestSnapshot?.metrics || {};
          const report = ws.performance_report_latest;

          const frequency = metrics.frequency || 0;
          const ctr = metrics.ctr || 0;
          const roas = metrics.roas || 0;
          const spend = metrics.spend || 0;
          const isFatigued = frequency >= 3.5;

          // Determine primary KPI display
          const goals = (ws.campaign_goals as any)?.[0];
          let primaryKpiLabel = goals?.primary_kpi_label || 'Results';
          let primaryKpiValue = '—';
          let primaryKpiGoal = '';

          if (goals) {
            const kpiKey = goals.primary_kpi;
            const val = metrics[kpiKey];
            if (val !== undefined && val !== null) {
              primaryKpiValue = kpiKey.includes('roas') ? `${Number(val).toFixed(1)}x` : `$${Number(val).toFixed(2)}`;
            }
            const goalType = goals.primary_kpi_goal_type === 'less_than' ? '<' : '>';
            const threshold = goals.primary_kpi_threshold;
            primaryKpiGoal = `${goalType} ${kpiKey.includes('roas') ? `${threshold}x` : `$${threshold}`}`;
          } else {
            // Fallback: show CPL or CPP
            const cplOrCpp = metrics.cpl || metrics.cpp;
            if (cplOrCpp) {
              primaryKpiLabel = metrics.cpl ? 'CPL' : 'CPP';
              primaryKpiValue = `$${Number(cplOrCpp).toFixed(2)}`;
            }
          }

          // Status determination
          let statusEmoji = '🟢';
          let statusNote = 'On track';

          if (report) {
            const hasRedKpi = Object.values(report.kpi_evaluation || {}).some((kpi: any) => kpi?.status === 'critical');
            const hasYellowKpi = Object.values(report.kpi_evaluation || {}).some((kpi: any) => kpi?.status === 'attention');

            if (hasRedKpi) {
              statusEmoji = '🔴';
              statusNote = 'Needs attention';
            } else if (hasYellowKpi || isFatigued) {
              statusEmoji = '🟡';
              statusNote = isFatigued ? 'Creative fatigue detected' : 'Monitor closely';
            }
          }

          if (!report && !latestSnapshot) {
            statusEmoji = '⏸️';
            statusNote = 'No data yet';
          }

          // Creative fatigue suggestion
          let fatigueSuggestion = '';
          if (isFatigued) {
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
            statusEmoji,
            statusNote,
            frequency,
            isFatigued,
            fatigueSuggestion,
            ctr,
            roas,
          });
        }

        const userName = profile.full_name || 'there';
        const frequencyLabel = reportFrequency === 'daily' ? 'Daily' : 'Weekly';

        const emailHtml = buildConsolidatedEmail({
          userName,
          brandName: brand.name,
          frequencyLabel,
          campaigns,
        });

        const { error: emailError } = await resend.emails.send({
          from: 'Lumi <reports@adsbylumi.com>',
          to: [profile.email],
          subject: `📊 ${frequencyLabel} Ad Report: ${brand.name} — ${campaigns.length} Campaign${campaigns.length !== 1 ? 's' : ''}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Email failed for user ${userId}:`, emailError);
          results.push({ userId, email: profile.email, status: 'error', error: emailError.message, campaignCount: campaigns.length });
        } else {
          console.log(`Consolidated email sent to ${profile.email} (${campaigns.length} campaigns)`);

          // Update last_report_sent_at
          const updatedPrefs = { ...prefs, report_frequency: reportFrequency, last_report_sent_at: today.toISOString() };
          await supabase.from('brands').update({ notification_preferences: updatedPrefs }).eq('id', brand.id);

          results.push({ userId, email: profile.email, status: 'sent', campaignCount: campaigns.length });
        }
      } catch (userError: any) {
        console.error(`Error processing user ${userId}:`, userError);
        results.push({ userId, email: '', status: 'error', error: userError.message, campaignCount: group.workspaces.length });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`Consolidated reports complete: ${sentCount} sent, ${errorCount} errors`);

    // Slack alert on failures
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

function buildConsolidatedEmail(params: {
  userName: string;
  brandName: string;
  frequencyLabel: string;
  campaigns: CampaignSummary[];
}): string {
  const { userName, brandName, frequencyLabel, campaigns } = params;

  // Aggregate totals
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const onTrack = campaigns.filter(c => c.statusEmoji === '🟢').length;
  const needsAttention = campaigns.filter(c => c.statusEmoji === '🔴' || c.statusEmoji === '🟡').length;
  const fatiguedCampaigns = campaigns.filter(c => c.isFatigued);

  // Build campaign rows
  const campaignRowsHtml = campaigns.map(c => `
    <tr>
      <td style="padding: 16px 20px; border-bottom: 1px solid #F1F5F9;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align: top;">
              <p style="margin: 0; font-size: 15px; font-weight: 700; color: #111;">${c.statusEmoji} ${c.name}</p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748B;">${c.statusNote}</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 10px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align: center; padding: 8px 4px;">
                    <div style="background: #F8FAFC; border-radius: 8px; padding: 10px 6px;">
                      <p style="margin: 0; font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Spend</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 800; color: #111;">$${c.spend.toFixed(2)}</p>
                    </div>
                  </td>
                  <td width="33%" style="text-align: center; padding: 8px 4px;">
                    <div style="background: #F8FAFC; border-radius: 8px; padding: 10px 6px;">
                      <p style="margin: 0; font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">${c.primaryKpiLabel}</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 800; color: #111;">${c.primaryKpiValue}</p>
                    </div>
                  </td>
                  <td width="33%" style="text-align: center; padding: 8px 4px;">
                    <div style="background: #F8FAFC; border-radius: 8px; padding: 10px 6px;">
                      <p style="margin: 0; font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Goal</p>
                      <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #64748B;">${c.primaryKpiGoal || '—'}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  // Build fatigue section
  const fatigueHtml = fatiguedCampaigns.length > 0 ? `
    <tr>
      <td style="padding: 0 30px 20px 30px;">
        <div style="background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border-radius: 12px; padding: 20px; border: 1px solid #FDE68A;">
          <p style="margin: 0; font-size: 16px; font-weight: 800; color: #92400E;">🔄 Creative Refresh Needed</p>
          <p style="margin: 6px 0 16px 0; font-size: 13px; color: #B45309;">These campaigns have high frequency — your audience is seeing the same ads too often.</p>
          ${fatiguedCampaigns.map(c => `
            <div style="background: #ffffff; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; border: 1px solid #FDE68A;">
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #111;">⚠️ ${c.name} <span style="font-weight: 500; color: #B45309; font-size: 12px;">(Frequency: ${c.frequency.toFixed(1)})</span></p>
              <p style="margin: 8px 0 12px 0; font-size: 13px; color: #4a5568; line-height: 1.6;">💡 ${c.fatigueSuggestion}</p>
              <a href="https://adsbylumi.com/creative-studio?workspace=${c.workspaceId}&refreshCreative=true" style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;">Refresh Creative →</a>
            </div>
          `).join('')}
        </div>
      </td>
    </tr>
  ` : '';

  // Summary strip
  const summaryColor = needsAttention > 0 ? '#F59E0B' : '#22C55E';
  const summaryText = needsAttention > 0
    ? `${onTrack} on track · ${needsAttention} need${needsAttention !== 1 ? '' : 's'} attention`
    : `All ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} on track 🎉`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${frequencyLabel} Ad Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">📊 ${frequencyLabel} Performance Report</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px; font-weight: 500;">${brandName} · ${campaigns.length} Campaign${campaigns.length !== 1 ? 's' : ''}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 35px 40px 10px 40px;">
              <p style="margin: 0; color: #111111; font-size: 17px; font-weight: 600;">Hey ${userName} 👋</p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.7;">Here's your ${frequencyLabel.toLowerCase()} snapshot across all your campaigns.</p>
            </td>
          </tr>

          <!-- Aggregate Summary -->
          <tr>
            <td style="padding: 16px 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-radius: 12px; padding: 16px; text-align: center;">
                      <p style="margin: 0; color: #9A3412; font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Total Spend</p>
                      <p style="margin: 4px 0 0 0; color: #111; font-size: 24px; font-weight: 800;">$${totalSpend.toFixed(2)}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: linear-gradient(135deg, ${needsAttention > 0 ? '#FFFBEB 0%, #FEF3C7' : '#F0FDF4 0%, #DCFCE7'} 100%); border-radius: 12px; padding: 16px; text-align: center;">
                      <p style="margin: 0; color: ${needsAttention > 0 ? '#92400E' : '#166534'}; font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Status</p>
                      <p style="margin: 4px 0 0 0; color: #111; font-size: 14px; font-weight: 700;">${summaryText}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Campaign Breakdown -->
          <tr>
            <td style="padding: 0 30px 10px 30px;">
              <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Campaign Breakdown</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #FAFBFC; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
                ${campaignRowsHtml}
              </table>
            </td>
          </tr>

          <!-- Creative Fatigue Section -->
          ${fatigueHtml}

          <!-- CTA -->
          <tr>
            <td style="padding: 10px 40px 35px 40px; text-align: center;">
              <a href="https://adsbylumi.com/data" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">View Full Dashboard →</a>
            </td>
          </tr>

          <!-- Closer -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0; color: #111111; font-size: 14px; font-weight: 600;">
                Keep going — you're doing amazing 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                This is an automated ${frequencyLabel.toLowerCase()} report. Manage preferences in your dashboard settings.
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
