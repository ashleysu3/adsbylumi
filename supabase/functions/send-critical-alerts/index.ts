import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
            from: 'Lumi Alerts <alerts@youradassistant.com>',
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
      <td style="padding: 15px 20px;">
        <div style="background: ${alert.severity === 'critical' ? '#FEF2F2' : '#FFFBEB'}; border-left: 4px solid ${alert.severity === 'critical' ? '#EF4444' : '#F59E0B'}; border-radius: 0 8px 8px 0; padding: 15px;">
          <p style="margin: 0; color: ${alert.severity === 'critical' ? '#991B1B' : '#92400E'}; font-size: 14px; font-weight: 600;">
            ${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alert.title}
          </p>
          <p style="margin: 8px 0 0 0; color: ${alert.severity === 'critical' ? '#B91C1C' : '#B45309'}; font-size: 13px;">
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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 25px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">🚨 Campaign Alert</h1>
              <p style="color: #FEE2E2; margin: 8px 0 0 0; font-size: 14px;">${campaignName}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 25px 20px 15px 20px;">
              <p style="margin: 0; color: #2d3748; font-size: 15px;">Hi ${userName},</p>
              <p style="margin: 10px 0 0 0; color: #718096; font-size: 14px;">
                We detected ${alerts.length > 1 ? 'some issues' : 'an issue'} with your ${brandName} campaign that needs your attention:
              </p>
            </td>
          </tr>

          <!-- Alerts -->
          ${alertsHtml}

          <!-- Action Section -->
          <tr>
            <td style="padding: 15px 20px;">
              <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; border-radius: 0 8px 8px 0; padding: 15px;">
                <p style="margin: 0; color: #1E40AF; font-size: 14px; font-weight: 600;">💡 What to do next</p>
                <p style="margin: 8px 0 0 0; color: #1D4ED8; font-size: 13px;">
                  Log in to your dashboard to review your campaign and make necessary adjustments. Lumi can help you diagnose and fix these issues.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 15px 20px 25px 20px; text-align: center;">
              <a href="https://youradassistant.com/data" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                View Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f7fafc; padding: 18px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px;">
                This is an automated alert from Lumi.<br>
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
