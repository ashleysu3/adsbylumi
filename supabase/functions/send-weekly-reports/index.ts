import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface WeeklyReportResult {
  workspaceId: string;
  workspaceName: string;
  email: string;
  status: 'sent' | 'skipped' | 'error';
  error?: string;
}

interface NotificationPrefs {
  report_frequency?: 'off' | 'daily' | 'weekly';
  critical_alerts?: boolean;
  performance_drops?: boolean;
  last_report_sent_at?: string;
  weekly_digest?: boolean; // Legacy field
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

    console.log('Starting performance report email job...');

    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

    // Find all published workspaces (have meta_campaign_ids) that are not archived
    const { data: workspaces, error: workspacesError } = await supabase
      .from('campaign_workspaces')
      .select(`
        id,
        name,
        brand_id,
        meta_campaign_ids,
        performance_report_latest,
        performance_history,
        offer_name,
        brands!inner(
          id,
          user_id,
          name,
          notification_preferences
        )
      `)
      .not('meta_campaign_ids', 'is', null)
      .eq('archived', false);

    if (workspacesError) {
      throw workspacesError;
    }

    console.log(`Found ${workspaces?.length || 0} published workspaces`);

    const results: WeeklyReportResult[] = [];

    for (const workspace of workspaces || []) {
      try {
        // brands comes as object from !inner join
        const brand = workspace.brands as any;
        const prefs: NotificationPrefs = brand.notification_preferences || {};
        
        // Determine report frequency (handle legacy weekly_digest boolean)
        let reportFrequency: 'off' | 'daily' | 'weekly' = prefs.report_frequency || 'weekly';
        if (!prefs.report_frequency && prefs.weekly_digest === false) {
          reportFrequency = 'off';
        }

        // Skip if reports are turned off
        if (reportFrequency === 'off') {
          console.log(`Workspace ${workspace.id}: Reports disabled, skipping`);
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            email: '',
            status: 'skipped',
            error: 'Reports disabled by user',
          });
          continue;
        }

        const lastSent = prefs.last_report_sent_at ? new Date(prefs.last_report_sent_at) : null;

        // Weekly: Only send on Mondays
        if (reportFrequency === 'weekly') {
          if (dayOfWeek !== 1) {
            console.log(`Workspace ${workspace.id}: Weekly report, but not Monday (day ${dayOfWeek}), skipping`);
            results.push({
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              email: '',
              status: 'skipped',
              error: 'Weekly report only sent on Mondays',
            });
            continue;
          }
          // Skip if sent within last 7 days
          if (lastSent && (today.getTime() - lastSent.getTime()) < 7 * 24 * 60 * 60 * 1000) {
            console.log(`Workspace ${workspace.id}: Weekly report already sent within 7 days, skipping`);
            results.push({
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              email: '',
              status: 'skipped',
              error: 'Weekly report already sent this week',
            });
            continue;
          }
        }

        // Daily: Skip if already sent today
        if (reportFrequency === 'daily') {
          if (lastSent && lastSent.toDateString() === today.toDateString()) {
            console.log(`Workspace ${workspace.id}: Daily report already sent today, skipping`);
            results.push({
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              email: '',
              status: 'skipped',
              error: 'Daily report already sent today',
            });
            continue;
          }
        }

        // Get user profile for email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', brand.user_id)
          .single();

        if (!profile?.email) {
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            email: '',
            status: 'skipped',
            error: 'No email found for user',
          });
          continue;
        }

        // Check if we have performance data
        if (!workspace.performance_report_latest) {
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            email: profile.email,
            status: 'skipped',
            error: 'No performance data available',
          });
          continue;
        }

        const report = workspace.performance_report_latest;
        const history = workspace.performance_history || [];
        const latestSnapshot = history[history.length - 1];
        const metrics = latestSnapshot?.metrics || {};

        const userName = profile.full_name || 'there';
        const campaignName = workspace.offer_name || workspace.name || 'Your Campaign';
        const frequencyLabel = reportFrequency === 'daily' ? 'Daily' : 'Weekly';

        // Try to generate a rich AI report using generate-client-report in self-serve mode
        let emailHtml = '';
        try {
          const reportResponse = await fetch(`${supabaseUrl}/functions/v1/generate-client-report`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              brandId: brand.id,
              mode: 'self-serve',
              dateRangeStart: new Date(Date.now() - (reportFrequency === 'daily' ? 1 : 7) * 86400000).toISOString().split('T')[0],
              dateRangeEnd: new Date().toISOString().split('T')[0],
            }),
          });

          // The generate-client-report function requires user auth, so for the cron
          // we fall back to the built-in HTML template if it fails
          if (reportResponse.ok) {
            const reportData = await reportResponse.json();
            if (reportData.report) {
              // Convert markdown report to beautiful HTML email
              emailHtml = buildRichEmailHtml({
                userName,
                campaignName,
                brandName: brand.name,
                frequencyLabel,
                reportMarkdown: reportData.report,
              });
            }
          }
        } catch (aiErr) {
          console.log(`AI report generation failed for ${workspace.id}, using fallback template:`, aiErr);
        }

        // Fallback to basic template if AI report failed
        if (!emailHtml) {
          emailHtml = buildEmailHtml({
            userName,
            campaignName,
            metrics,
            report,
            brandName: brand.name,
            frequencyLabel,
          });
        }

        // Send email via Resend
        const { error: emailError } = await resend.emails.send({
          from: 'Lumi <reports@adsbylumi.com>',
          to: [profile.email],
          subject: `📊 ${frequencyLabel} Ad Report: ${campaignName}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Email send failed for ${workspace.id}:`, emailError);
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            email: profile.email,
            status: 'error',
            error: emailError.message,
          });
        } else {
          console.log(`Email sent to ${profile.email} for workspace ${workspace.id}`);
          
          // Update last_report_sent_at in brand's notification_preferences
          const updatedPrefs = {
            ...prefs,
            report_frequency: reportFrequency,
            last_report_sent_at: today.toISOString(),
          };
          
          await supabase
            .from('brands')
            .update({ notification_preferences: updatedPrefs })
            .eq('id', brand.id);
          
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            email: profile.email,
            status: 'sent',
          });
        }
      } catch (workspaceError: any) {
        console.error(`Error processing workspace ${workspace.id}:`, workspaceError);
        results.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          email: '',
          status: 'error',
          error: workspaceError.message,
        });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`Performance reports complete: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`);

    // Slack alert if emails failed
    if (errorCount > 0) {
      try {
        const failedEmails = results.filter(r => r.status === 'error').map(r => `• ${r.workspaceName}: ${r.error}`).join('\n');
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/slack-error-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            category: 'Email',
            severity: 'warning',
            title: `${errorCount} Report Email${errorCount !== 1 ? 's' : ''} Failed`,
            message: `${sentCount} sent, ${errorCount} failed:\n${failedEmails}`,
            source: 'send-weekly-reports',
          }),
        });
      } catch { /* ignore */ }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          sent: sentCount,
          skipped: skippedCount,
          errors: errorCount,
        },
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-weekly-reports:', error);
    // Slack alert for fatal email system errors
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/slack-error-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          category: 'Email',
          severity: 'critical',
          title: 'Weekly Reports System Failure',
          message: `Fatal error in send-weekly-reports: ${error.message}`,
          source: 'send-weekly-reports',
        }),
      });
    } catch { /* ignore */ }
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function buildEmailHtml(params: {
  userName: string;
  campaignName: string;
  metrics: any;
  report: any;
  brandName: string;
  frequencyLabel: string;
  lumiInsights?: string[];
}): string {
  const { userName, campaignName, metrics, report, brandName, frequencyLabel, lumiInsights = [] } = params;

  // Determine overall status color
  const overallHealth = report.kpi_evaluation?.roas?.status === 'excellent' || 
                        report.kpi_evaluation?.ctr?.status === 'excellent' 
                        ? '#10B981' 
                        : report.kpi_evaluation?.frequency?.value > 4 
                        ? '#F59E0B' 
                        : '#3B82F6';

  // Build what's working section
  const workingItems: string[] = [];
  if (report.kpi_evaluation?.ctr?.status === 'healthy' || report.kpi_evaluation?.ctr?.status === 'excellent') {
    workingItems.push(`CTR is ${report.kpi_evaluation.ctr.status}`);
  }
  if (report.kpi_evaluation?.cpc?.status === 'healthy' || report.kpi_evaluation?.cpc?.status === 'excellent') {
    workingItems.push(`Cost per click: $${metrics.cpc?.toFixed(2) || '0.00'}`);
  }
  if (report.funnel_diagnosis?.tofu?.includes('healthy') || report.funnel_diagnosis?.tofu?.includes('strong')) {
    workingItems.push('Top of funnel is driving awareness');
  }

  // Build needs attention section
  const attentionItems: string[] = [];
  if (report.creative_diagnosis?.problem) {
    attentionItems.push(report.creative_diagnosis.problem);
  }
  if (report.kpi_evaluation?.frequency?.value > 3) {
    attentionItems.push(`Ad frequency is ${report.kpi_evaluation.frequency.value?.toFixed(1)} - consider refreshing creative`);
  }
  if (report.warm_audience_health?.stability === 'Low') {
    attentionItems.push('Warm audience needs growth');
  }

  // Build Lumi insights section
  const lumiInsightsHtml = lumiInsights.length > 0 ? `
    <tr>
      <td style="padding: 0 30px 20px 30px;">
        <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-left: 4px solid #EA580C; border-radius: 0 8px 8px 0; padding: 15px;">
          <p style="margin: 0; color: #9A3412; font-size: 14px; font-weight: 600;">✨ Lumi's ${frequencyLabel} Insights</p>
          ${lumiInsights.map(insight => `<p style="margin: 8px 0 0 0; color: #C2410C; font-size: 13px;">• ${insight}</p>`).join('')}
        </div>
      </td>
    </tr>
  ` : '';

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
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">📊 ${frequencyLabel} Performance Report</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px; font-weight: 500;">${campaignName}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 35px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 17px; font-weight: 600;">Hey ${userName} 👋</p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.7;">Here's how your ${brandName} ads performed${frequencyLabel === 'Daily' ? ' today' : ' this week'}. Let's break it down.</p>
            </td>
          </tr>

          <!-- Metrics Grid -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding: 8px;">
                    <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-radius: 12px; padding: 18px; text-align: center;">
                      <p style="margin: 0; color: #9A3412; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Spend</p>
                      <p style="margin: 6px 0 0 0; color: #111111; font-size: 26px; font-weight: 800;">$${metrics.spend?.toFixed(2) || '0.00'}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding: 8px;">
                    <div style="background: linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%); border-radius: 12px; padding: 18px; text-align: center;">
                      <p style="margin: 0; color: #9D174D; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Reach</p>
                      <p style="margin: 6px 0 0 0; color: #111111; font-size: 26px; font-weight: 800;">${(metrics.reach || 0).toLocaleString()}</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 8px;">
                    <div style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 18px; text-align: center;">
                      <p style="margin: 0; color: #5B21B6; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Conversions</p>
                      <p style="margin: 6px 0 0 0; color: #111111; font-size: 26px; font-weight: 800;">${metrics.leads || metrics.purchases || 0}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding: 8px;">
                    <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 18px; text-align: center;">
                      <p style="margin: 0; color: #1E40AF; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Cost/Result</p>
                      <p style="margin: 6px 0 0 0; color: #111111; font-size: 26px; font-weight: 800;">$${(metrics.cpl || metrics.cpp || 0).toFixed(2)}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Lumi Insights -->
          ${lumiInsightsHtml}

          <!-- What's Working -->
          ${workingItems.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 16px 40px;">
              <div style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border-left: 4px solid #22C55E; border-radius: 0 12px 12px 0; padding: 18px;">
                <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 700;">✅ What's Working</p>
                ${workingItems.map(item => `<p style="margin: 8px 0 0 0; color: #15803D; font-size: 13px; line-height: 1.6;">• ${item}</p>`).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Needs Attention -->
          ${attentionItems.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 16px 40px;">
              <div style="background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border-left: 4px solid #F59E0B; border-radius: 0 12px 12px 0; padding: 18px;">
                <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 700;">⚠️ Needs Attention</p>
                ${attentionItems.map(item => `<p style="margin: 8px 0 0 0; color: #B45309; font-size: 13px; line-height: 1.6;">• ${item}</p>`).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Next Steps -->
          ${report.next_steps && report.next_steps.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-left: 4px solid #3B82F6; border-radius: 0 12px 12px 0; padding: 18px;">
                <p style="margin: 0; color: #1E40AF; font-size: 14px; font-weight: 700;">✦ Your Next Moves</p>
                ${report.next_steps.slice(0, 3).map((step: string, i: number) => `<p style="margin: 8px 0 0 0; color: #1D4ED8; font-size: 13px; line-height: 1.6;">${i + 1}. ${step}</p>`).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 10px 40px 35px 40px; text-align: center;">
              <a href="https://adsbylumi.com/data" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">View Full Dashboard →</a>
            </td>
          </tr>

          <!-- Warm closer -->
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

function buildRichEmailHtml(params: {
  userName: string;
  campaignName: string;
  brandName: string;
  frequencyLabel: string;
  reportMarkdown: string;
}): string {
  const { userName, campaignName, brandName, frequencyLabel, reportMarkdown } = params;

  // Convert markdown to styled HTML
  const convertMarkdownToHtml = (md: string): string => {
    let html = md;

    // H3 headers → styled headers
    html = html.replace(/^### (.+)$/gm, '<h2 style="margin: 28px 0 12px 0; color: #111111; font-size: 18px; font-weight: 800; font-family: \'Red Hat Display\', sans-serif;">$1</h2>');

    // H4 headers
    html = html.replace(/^#### (.+)$/gm, '<h3 style="margin: 20px 0 8px 0; color: #333; font-size: 15px; font-weight: 700;">$1</h3>');

    // Bold text
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 700; color: #111;">$1</strong>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #F5F3EE; margin: 20px 0;">');

    // Checklist items
    html = html.replace(/^- \[ \] (.+)$/gm, '<div style="margin: 6px 0; padding: 8px 12px; background: #F8FAFC; border-radius: 8px; font-size: 13px; color: #333;">☐ $1</div>');
    html = html.replace(/^- \[x\] (.+)$/gm, '<div style="margin: 6px 0; padding: 8px 12px; background: #F0FDF4; border-radius: 8px; font-size: 13px; color: #166534;">☑️ $1</div>');

    // Bullet points
    html = html.replace(/^- (.+)$/gm, '<div style="margin: 4px 0; padding-left: 16px; font-size: 13px; color: #4a5568; line-height: 1.7;">• $1</div>');

    // Tables
    html = html.replace(/\|(.+)\|\n\|[-|\s:]+\|\n((?:\|.+\|\n?)+)/g, (_, header, rows) => {
      const headerCells = header.split('|').map((c: string) => c.trim()).filter(Boolean);
      const dataRows = rows.trim().split('\n').map((row: string) =>
        row.split('|').map((c: string) => c.trim()).filter(Boolean)
      );
      let table = '<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px;">';
      table += '<tr>' + headerCells.map((h: string) => `<th style="text-align: left; padding: 8px 12px; background: #F8FAFC; border-bottom: 2px solid #E2E8F0; color: #64748B; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${h.replace(/\*\*/g, '')}</th>`).join('') + '</tr>';
      for (const row of dataRows) {
        table += '<tr>' + row.map((c: string) => `<td style="padding: 8px 12px; border-bottom: 1px solid #F1F5F9; color: #333;">${c}</td>`).join('') + '</tr>';
      }
      table += '</table>';
      return table;
    });

    // Paragraphs (lines that aren't already HTML)
    html = html.replace(/^(?!<[a-z])((?!\s*$).+)$/gm, (match) => {
      if (match.trim().startsWith('<')) return match;
      return `<p style="margin: 8px 0; color: #4a5568; font-size: 14px; line-height: 1.7;">${match}</p>`;
    });

    return html;
  };

  const bodyHtml = convertMarkdownToHtml(reportMarkdown);

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
          <tr>
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 35px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">📊 ${frequencyLabel} Performance Report</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px; font-weight: 500;">${brandName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 17px; font-weight: 600;">Hey ${userName} 👋</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 35px 40px; text-align: center;">
              <a href="https://adsbylumi.com/data" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3);">View Full Dashboard →</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0; color: #111111; font-size: 14px; font-weight: 600;">
                Keep going — you're doing amazing 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>
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
