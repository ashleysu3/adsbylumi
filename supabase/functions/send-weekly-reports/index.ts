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

        // Build HTML email
        const emailHtml = buildEmailHtml({
          userName,
          campaignName,
          metrics,
          report,
          brandName: brand.name,
          frequencyLabel,
        });

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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">📊 ${frequencyLabel} Performance Report</h1>
              <p style="color: #a0aec0; margin: 10px 0 0 0; font-size: 14px;">${campaignName}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="margin: 0; color: #2d3748; font-size: 16px;">Hi ${userName},</p>
              <p style="margin: 10px 0 0 0; color: #718096; font-size: 14px;">Here's how your ${brandName} ads performed${frequencyLabel === 'Daily' ? ' today' : ' this week'}.</p>
            </td>
          </tr>

          <!-- Metrics Grid -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding: 10px;">
                    <div style="background: #f7fafc; border-radius: 8px; padding: 15px; text-align: center;">
                      <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Spend</p>
                      <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 24px; font-weight: 600;">$${metrics.spend?.toFixed(2) || '0.00'}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding: 10px;">
                    <div style="background: #f7fafc; border-radius: 8px; padding: 15px; text-align: center;">
                      <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Reach</p>
                      <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 24px; font-weight: 600;">${(metrics.reach || 0).toLocaleString()}</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 10px;">
                    <div style="background: #f7fafc; border-radius: 8px; padding: 15px; text-align: center;">
                      <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Conversions</p>
                      <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 24px; font-weight: 600;">${metrics.leads || metrics.purchases || 0}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding: 10px;">
                    <div style="background: #f7fafc; border-radius: 8px; padding: 15px; text-align: center;">
                      <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Cost/Result</p>
                      <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 24px; font-weight: 600;">$${(metrics.cpl || metrics.cpp || 0).toFixed(2)}</p>
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
            <td style="padding: 0 30px 20px 30px;">
              <div style="background: #f0fff4; border-left: 4px solid #48bb78; border-radius: 0 8px 8px 0; padding: 15px;">
                <p style="margin: 0; color: #22543d; font-size: 14px; font-weight: 600;">✅ What's Working</p>
                ${workingItems.map(item => `<p style="margin: 8px 0 0 0; color: #276749; font-size: 13px;">• ${item}</p>`).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Needs Attention -->
          ${attentionItems.length > 0 ? `
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background: #fffaf0; border-left: 4px solid #ed8936; border-radius: 0 8px 8px 0; padding: 15px;">
                <p style="margin: 0; color: #744210; font-size: 14px; font-weight: 600;">⚠️ Needs Attention</p>
                ${attentionItems.map(item => `<p style="margin: 8px 0 0 0; color: #975a16; font-size: 13px;">• ${item}</p>`).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Next Steps -->
          ${report.next_steps && report.next_steps.length > 0 ? `
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background: #ebf8ff; border-left: 4px solid #4299e1; border-radius: 0 8px 8px 0; padding: 15px;">
                <p style="margin: 0; color: #2c5282; font-size: 14px; font-weight: 600;">📋 Your Next Steps</p>
                ${report.next_steps.slice(0, 3).map((step: string, i: number) => `<p style="margin: 8px 0 0 0; color: #2b6cb0; font-size: 13px;">${i + 1}. ${step}</p>`).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 10px 30px 30px 30px; text-align: center;">
              <a href="https://youradassistant.com/data" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Full Dashboard →</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f7fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                This is an automated ${frequencyLabel.toLowerCase()} report from Lumi.<br>
                Keep going - you're doing great! 🎉
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
