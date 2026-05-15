import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isServiceRoleRequest } from "../_shared/internal-auth.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all enabled digest settings
    const { data: settings, error } = await supabase
      .from('digest_settings')
      .select('*, brands!inner(id, name, user_id)')
      .eq('enabled', true);

    if (error) {
      console.error('Error fetching digest settings:', error);
      throw error;
    }

    if (!settings || settings.length === 0) {
      console.log('No enabled digest settings found');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    let processed = 0;

    for (const setting of settings) {
      try {
        // Get current time in the user's timezone
        const now = new Date();
        const userTime = new Date(now.toLocaleString('en-US', { timeZone: setting.timezone || 'America/New_York' }));
        const currentDay = dayNames[userTime.getDay()];
        const currentHour = `${String(userTime.getHours()).padStart(2, '0')}:00`;

        // Check if it's the right day and hour
        const activeDays = (setting as any).send_days?.length > 0 
          ? (setting as any).send_days 
          : [setting.send_day];
        if (!activeDays.includes(currentDay)) continue;
        if (currentHour !== setting.send_time) continue;

        // Check if already sent today
        if (setting.last_sent_at) {
          const lastSent = new Date(setting.last_sent_at);
          const hoursDiff = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
          if (hoursDiff < 20) continue;
        }

        const brandId = setting.brand_id;
        const dateRangeDays = setting.date_range_days || 7;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - dateRangeDays);

        const dateRangeStart = startDate.toISOString().split('T')[0];
        const dateRangeEnd = endDate.toISOString().split('T')[0];

        const brand = (setting as any).brands;

        // Fetch workspaces for this brand
        const { data: workspaces } = await supabase
          .from('campaign_workspaces')
          .select('id')
          .eq('brand_id', brandId)
          .in('progress_status', ['live', 'ready_to_publish'])
          .eq('archived', false);

        if (!workspaces || workspaces.length === 0) continue;

        // Try to run the optimization report
        const reportRes = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/run-optimization-report`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ brandId, dateRangeStart, dateRangeEnd }),
          }
        );

        let reportId: string | null = null;
        let reportData: any = null;

        if (!reportRes.ok) {
          console.log(`Skipping brand ${brandId} — cannot run report in cron context`);
          // Create report directly with service role
          const { data: report } = await supabase
            .from('optimization_reports')
            .insert({
              brand_id: brandId,
              created_by: brand.user_id,
              date_range_start: dateRangeStart,
              date_range_end: dateRangeEnd,
              report_data: [],
              summary: { green: 0, yellow: 0, red: 0, unconfigured: 0, total: 0, note: 'Automated digest — view dashboard for full report' },
            })
            .select()
            .single();

          if (report) {
            reportId = report.id;
            reportData = report;
          }
        } else {
          const reportResult = await reportRes.json();
          if (reportResult.report?.id) {
            reportId = reportResult.report.id;
            reportData = reportResult.report;
          }
        }

        // Send the digest email
        if (reportId) {
          await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-optimization-digest`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              },
              body: JSON.stringify({ brandId, reportId }),
            }
          );
        }

        // ─── Red-alert check: send critical alerts if any campaigns are red ───
        const alertOnRed = (setting as any).alert_on_red ?? true;
        if (alertOnRed && reportData) {
          const summary = reportData.summary || {};
          const redCount = summary.red || 0;

          if (redCount > 0) {
            const redCampaigns = (reportData.report_data || []).filter(
              (c: any) => c.status === 'red'
            );

            console.log(`Brand ${brandId} has ${redCount} red campaigns — sending critical alert`);

            await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-critical-alerts`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({
                  brandId,
                  userId: brand.user_id,
                  redCampaigns,
                  reportId,
                }),
              }
            );
          }
        }

        // ─── Run apply-optimizations to queue or auto-apply recommendations ───
        const autoOptimize = (setting as any).auto_optimize ?? false;
        if (reportId) {
          try {
            await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/apply-optimizations`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({ brandId, reportId, autoOptimize }),
              }
            );
          } catch (e) {
            console.error(`Error calling apply-optimizations for brand ${brandId}:`, e);
          }
        }

        // Update last_sent_at
        await supabase
          .from('digest_settings')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', setting.id);

        processed++;
        console.log(`Processed digest for brand ${brandId}`);
      } catch (e) {
        console.error(`Error processing digest for setting ${setting.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Schedule digests error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
