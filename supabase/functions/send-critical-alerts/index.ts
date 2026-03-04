import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface AlertType {
  type: 'budget_depleting' | 'performance_drop' | 'creative_fatigue' | 'high_frequency' | 'low_roas';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

interface AlertResult {
  workspaceId: string;
  workspaceName: string;
  email: string;
  alerts: AlertType[];
  status: 'sent' | 'skipped' | 'error';
  error?: string;
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

    console.log('Starting critical alerts check...');

    // Get all active published workspaces
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
        strategy_json,
        brands!inner(
          id,
          user_id,
          name
        )
      `)
      .not('meta_campaign_ids', 'is', null)
      .eq('archived', false);

    if (workspacesError) {
      throw workspacesError;
    }

    console.log(`Checking ${workspaces?.length || 0} workspaces for critical alerts`);

    const results: AlertResult[] = [];

    for (const workspace of workspaces || []) {
      try {
        const brand = workspace.brands as any;
        
        // Get user profile for email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', brand.user_id)
          .single();

        if (!profile?.email) {
          continue;
        }

        // Check for alerts
        const alerts: AlertType[] = [];
        const report = workspace.performance_report_latest;
        const history = workspace.performance_history || [];
        const latestSnapshot = history[history.length - 1];
        const previousSnapshot = history[history.length - 2];
        const metrics = latestSnapshot?.metrics || {};
        const prevMetrics = previousSnapshot?.metrics || {};

        // Check budget depletion (if spend rate is high)
        const strategy = workspace.strategy_json as any;
        const budget = strategy?.budget?.daily || strategy?.budget?.total;
        if (budget && metrics.spend) {
          const spendRate = metrics.spend / budget;
          if (spendRate > 0.9) {
            alerts.push({
              type: 'budget_depleting',
              severity: spendRate > 0.95 ? 'critical' : 'warning',
              title: 'Budget Running Low',
              message: `Your campaign has used ${Math.round(spendRate * 100)}% of its budget.`,
              metric: 'Budget Usage',
              value: spendRate * 100,
              threshold: 90,
            });
          }
        }

        // Check CTR drop
        if (prevMetrics.ctr && metrics.ctr) {
          const ctrDrop = ((prevMetrics.ctr - metrics.ctr) / prevMetrics.ctr) * 100;
          if (ctrDrop > 25) {
            alerts.push({
              type: 'performance_drop',
              severity: ctrDrop > 50 ? 'critical' : 'warning',
              title: 'CTR Dropped Significantly',
              message: `Your click-through rate dropped by ${Math.round(ctrDrop)}% compared to the previous period.`,
              metric: 'CTR',
              value: metrics.ctr,
              threshold: prevMetrics.ctr * 0.75,
            });
          }
        }

        // Check creative fatigue (high frequency)
        if (metrics.frequency && metrics.frequency >= 4) {
          alerts.push({
            type: 'high_frequency',
            severity: metrics.frequency >= 6 ? 'critical' : 'warning',
            title: 'Creative Fatigue Detected',
            message: `Ad frequency is ${metrics.frequency.toFixed(1)}. Your audience may be seeing ads too often.`,
            metric: 'Frequency',
            value: metrics.frequency,
            threshold: 4,
          });
        }

        // Check ROAS drop
        if (prevMetrics.roas && metrics.roas && prevMetrics.roas > 1) {
          const roasDrop = ((prevMetrics.roas - metrics.roas) / prevMetrics.roas) * 100;
          if (roasDrop > 30) {
            alerts.push({
              type: 'low_roas',
              severity: metrics.roas < 1 ? 'critical' : 'warning',
              title: 'ROAS Declining',
              message: `Return on ad spend dropped by ${Math.round(roasDrop)}% to ${metrics.roas.toFixed(2)}x.`,
              metric: 'ROAS',
              value: metrics.roas,
              threshold: prevMetrics.roas * 0.7,
            });
          }
        }

        // If there are critical alerts, send email
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        
        if (criticalAlerts.length > 0) {
          const emailHtml = buildAlertEmailHtml({
            userName: profile.full_name || 'there',
            campaignName: workspace.offer_name || workspace.name || 'Your Campaign',
            brandName: brand.name,
            alerts: criticalAlerts,
          });

          const { error: emailError } = await resend.emails.send({
            from: 'Lumi Alerts <alerts@adsbylumi.com>',
            to: [profile.email],
            subject: `🚨 Critical Alert: ${criticalAlerts[0].title}`,
            html: emailHtml,
          });

          if (emailError) {
            console.error(`Alert email failed for ${workspace.id}:`, emailError);
            results.push({
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              email: profile.email,
              alerts: criticalAlerts,
              status: 'error',
              error: emailError.message,
            });
          } else {
            console.log(`Alert email sent to ${profile.email} for workspace ${workspace.id}`);
            results.push({
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              email: profile.email,
              alerts: criticalAlerts,
              status: 'sent',
            });
          }
        } else if (alerts.length > 0) {
          // Log warnings but don't email
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            email: profile.email,
            alerts,
            status: 'skipped',
            error: 'Only warning-level alerts, no email sent',
          });
        }
      } catch (workspaceError: any) {
        console.error(`Error checking workspace ${workspace.id}:`, workspaceError);
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const totalAlerts = results.reduce((sum, r) => sum + r.alerts.length, 0);

    console.log(`Critical alerts check complete: ${sentCount} emails sent, ${totalAlerts} total alerts detected`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          workspacesChecked: workspaces?.length || 0,
          emailsSent: sentCount,
          totalAlerts,
        },
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-critical-alerts:', error);
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

function buildAlertEmailHtml(params: {
  userName: string;
  campaignName: string;
  brandName: string;
  alerts: AlertType[];
}): string {
  const { userName, campaignName, brandName, alerts } = params;

  const alertsHtml = alerts.map(alert => `
    <tr>
      <td style="padding: 10px 40px;">
        <div style="background: ${alert.severity === 'critical' ? '#FEF2F2' : '#FFFBEB'}; border-left: 4px solid ${alert.severity === 'critical' ? '#EF4444' : '#F59E0B'}; border-radius: 0 12px 12px 0; padding: 18px 20px;">
          <p style="margin: 0; color: ${alert.severity === 'critical' ? '#991B1B' : '#92400E'}; font-size: 14px; font-weight: 700; font-family: 'Red Hat Display', sans-serif;">
            ${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alert.title}
          </p>
          <p style="margin: 8px 0 0 0; color: ${alert.severity === 'critical' ? '#B91C1C' : '#B45309'}; font-size: 13px; line-height: 1.6;">
            ${alert.message}
          </p>
        </div>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campaign Alert</title>
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
            <td style="background: linear-gradient(135deg, #F97316 0%, #EC4899 40%, #A78BFA 70%, #93C5FD 100%); padding: 40px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">🚨 Campaign Alert</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px; font-weight: 500;">${campaignName}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 35px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 17px; font-weight: 600; line-height: 1.5;">Hey ${userName} 👋</p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8; font-weight: 400;">
                I spotted ${alerts.length > 1 ? 'a few things' : 'something'} with your <strong>${brandName}</strong> campaign that could use your attention:
              </p>
            </td>
          </tr>

          <!-- Alerts -->
          ${alertsHtml}

          <!-- Action Section -->
          <tr>
            <td style="padding: 15px 40px;">
              <div style="background: #F5F3FF; border-left: 4px solid #A78BFA; border-radius: 0 12px 12px 0; padding: 18px 20px;">
                <p style="margin: 0; color: #5B21B6; font-size: 14px; font-weight: 700; font-family: 'Red Hat Display', sans-serif;">💡 What to do next</p>
                <p style="margin: 8px 0 0 0; color: #6D28D9; font-size: 13px; line-height: 1.7;">
                  Pop into your dashboard and I'll walk you through what's happening and how to fix it. No guesswork — I've got you. 💜
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 20px 40px 30px 40px; text-align: center;">
              <a href="https://adsbylumi.com/data" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                View Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br>
                You're receiving this because you have active campaigns.
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
