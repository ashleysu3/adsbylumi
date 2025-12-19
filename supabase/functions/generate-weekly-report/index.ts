import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch workspace with latest performance report
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace not found');
    }

    const report = workspace.performance_report_latest;
    if (!report) {
      throw new Error('No performance analysis available');
    }

    // Get latest metrics from performance history
    const history = workspace.performance_history || [];
    const latestSnapshot = history[history.length - 1];
    const metrics = latestSnapshot?.metrics || {};

    // Fetch user name
    const { data: brand } = await supabase
      .from('brands')
      .select('user_id, name')
      .eq('id', workspace.brand_id)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', brand?.user_id)
      .single();

    const userName = profile?.full_name || 'there';
    const campaignName = workspace.name || 'Your Campaign';

    // Build email report
    const emailReport = `
Subject: Your Weekly Ad Performance Report - ${campaignName}

Hi ${userName},

Here's what happened with your ${campaignName} ads this week 📊

=== WEEKLY OVERVIEW ===
💰 Spend: $${metrics.spend?.toFixed(2) || '0.00'}
👀 Reach: ${metrics.reach?.toLocaleString() || '0'} people
🎯 Conversions: ${metrics.leads || metrics.purchases || 0}
💵 Cost per Result: $${(metrics.cpl || metrics.cpp || 0).toFixed(2)}

=== WHAT WORKED ===
${report.kpi_evaluation?.ctr?.status === 'healthy' || report.kpi_evaluation?.ctr?.status === 'excellent' 
  ? `✅ Your CTR is ${report.kpi_evaluation.ctr.status}! ${report.kpi_evaluation.ctr.reason}` 
  : ''}
${report.kpi_evaluation?.cpc?.status === 'healthy' || report.kpi_evaluation?.cpc?.status === 'excellent'
  ? `✅ Cost per click is performing well at $${metrics.cpc?.toFixed(2)}`
  : ''}
${report.funnel_diagnosis?.tofu?.includes('healthy') || report.funnel_diagnosis?.tofu?.includes('strong')
  ? `✅ Top of funnel is working - your awareness is growing`
  : ''}

=== WHAT NEEDS ATTENTION ===
${report.creative_diagnosis?.problem 
  ? `⚠️ ${report.creative_diagnosis.problem}\n💡 ${report.creative_diagnosis.cause}`
  : ''}
${report.funnel_diagnosis?.mofu?.includes('weak') || report.funnel_diagnosis?.mofu?.includes('needs')
  ? `⚠️ Middle of funnel needs work: ${report.funnel_diagnosis.mofu}`
  : ''}
${report.warm_audience_health?.stability === 'Low'
  ? `⚠️ Warm audience is small: ${report.warm_audience_health.recommendation}`
  : ''}

=== FUNNEL HEALTH ===
🔝 Top of Funnel (Awareness): ${report.funnel_diagnosis?.tofu || 'Looking good'}
🎯 Middle of Funnel (Consideration): ${report.funnel_diagnosis?.mofu || 'On track'}
💰 Bottom of Funnel (Conversion): ${report.funnel_diagnosis?.bofu || 'Converting'}

=== CREATIVE REFRESH NEEDED ===
${report.creative_diagnosis?.recommended_creatives_to_add 
  ? report.creative_diagnosis.recommended_creatives_to_add.map((c: string) => `🎨 ${c}`).join('\n')
  : 'Your creative mix is looking fresh!'}

=== YOUR TOP 3 NEXT STEPS ===
${report.next_steps?.map((step: string, i: number) => `${i + 1}️⃣ ${step}`).join('\n') || '1️⃣ Keep monitoring your performance\n2️⃣ Test new creative variations\n3️⃣ Optimize your top performers'}

=== A NOTE FROM LUMI ===
${report.seasonality_context?.notes 
  ? `${report.seasonality_context.notes} ${report.seasonality_context.recommendation}`
  : `You're making great progress! Remember, consistency is key in Meta Ads. Keep testing, keep learning, and keep improving.`}

${report.kpi_evaluation?.ctr?.status === 'excellent' || report.kpi_evaluation?.roas?.status === 'excellent'
  ? '🎉 Your ads are performing exceptionally well - keep up the momentum!'
  : report.kpi_evaluation?.frequency?.value > 4
  ? '💡 Time to refresh your creative - your audience is seeing the same ads too often.'
  : '📈 You\'re on the right track - small improvements compound over time!'}

[View Full Dashboard] → ${Deno.env.get('SUPABASE_URL')?.replace('https://', 'https://').split('.supabase.co')[0]}.lovable.app/data

Keep going - you're doing great! 🎉
- Lumi

---
This is an automated weekly report from Lumi.
`;

    // Save to database
    await supabase
      .from('campaign_workspaces')
      .update({
        weekly_report_draft: emailReport,
      })
      .eq('id', workspaceId);

    console.log('Weekly report generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        report: emailReport,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating weekly report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
