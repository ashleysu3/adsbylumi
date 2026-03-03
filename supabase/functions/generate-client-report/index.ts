import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { brandId, dateRangeStart, dateRangeEnd } = await req.json();
    if (!brandId) throw new Error('brandId is required');

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, user_id')
      .eq('id', brandId)
      .single();
    if (brandError || !brand) throw new Error('Brand not found');
    if (brand.user_id !== user.id) throw new Error('Access denied');

    // Fetch all campaign workspaces with meta_campaign_ids
    const { data: workspaces, error: wsError } = await supabase
      .from('campaign_workspaces')
      .select(`
        id, name, meta_campaign_ids, meta_campaign_status,
        final_answers, performance_history, performance_report_latest,
        campaign_builder_answers, template_id, offer_name,
        campaign_templates!campaign_workspaces_template_id_fkey (name, objective)
      `)
      .eq('brand_id', brandId)
      .not('meta_campaign_ids', 'is', null);

    if (wsError) throw new Error('Failed to fetch campaigns');

    // Filter to real published campaigns
    const campaigns = (workspaces || []).filter((w: any) => {
      const campaignId = w.meta_campaign_ids?.campaignId;
      if (!campaignId) return false;
      if (w.meta_campaign_status === 'draft') return false;
      return true;
    });

    if (campaigns.length === 0) {
      throw new Error('No published campaigns found for this brand');
    }

    // Build campaign data for the prompt
    const campaignSummaries: any[] = [];
    let totalSpend = 0;
    let totalRevenue = 0;

    for (const ws of campaigns) {
      const history = (ws.performance_history as any[]) || [];
      const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;
      const metrics = latestSnapshot?.metrics || {};
      const finalAnswers = ws.final_answers as any;
      const template = ws.campaign_templates as any;
      const objective = template?.objective || 'unknown';
      const templateName = template?.name || '';
      const userGoal = finalAnswers?.userKpiGoal || null;
      const builderAnswers = ws.campaign_builder_answers as any;
      const dailyBudget = builderAnswers?.budget || metrics?.dailyBudget || null;
      const status = ((ws.meta_campaign_status || 'unknown') as string).toUpperCase();

      const spend = Number(metrics.spend || 0);
      const revenue = Number(metrics.purchase_roas || 0) * spend;
      totalSpend += spend;
      totalRevenue += revenue;

      // Determine primary KPI
      let primaryKPI = 'cpl';
      let primaryValue: number | null = null;
      const nameLC = (ws.name || '').toLowerCase();
      const objLC = objective.toLowerCase();

      if (objLC.includes('sale') || objLC.includes('purchase') || nameLC.includes('sale')) {
        primaryKPI = 'cpp';
        primaryValue = metrics.cpp || null;
      } else if (objLC.includes('lead') || nameLC.includes('lead')) {
        primaryKPI = 'cpl';
        primaryValue = metrics.cpl || null;
      } else if (objLC.includes('video') || nameLC.includes('video')) {
        primaryKPI = 'costPerThruPlay';
        primaryValue = metrics.costPerThruPlay || null;
      }

      // Get ad-level breakdown from performance_report_latest
      const report = ws.performance_report_latest as any;
      const adBreakdown = report?.ad_breakdown || [];

      campaignSummaries.push({
        name: ws.name,
        objective,
        templateName,
        status,
        primaryKPI,
        primaryValue,
        userGoal,
        dailyBudget,
        metrics: {
          spend: metrics.spend,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          ctr: metrics.ctr,
          cpc: metrics.cpc,
          cpl: metrics.cpl,
          cpp: metrics.cpp,
          roas: metrics.roas,
          leads: metrics.leads,
          purchases: metrics.purchases,
          frequency: metrics.frequency,
          reach: metrics.reach,
        },
        topCreatives: adBreakdown.slice(0, 3).map((ad: any) => ({
          name: ad.name || ad.ad_name,
          spend: ad.spend,
          results: ad.leads || ad.purchases || 0,
          cpl: ad.cpl,
          cpp: ad.cpp,
          roas: ad.roas,
          ctr: ad.ctr,
        })),
        underperformers: adBreakdown.filter((ad: any) => {
          if (primaryKPI === 'cpl' && userGoal && ad.cpl > userGoal * 1.3) return true;
          if (primaryKPI === 'cpp' && userGoal && ad.cpp > userGoal * 1.3) return true;
          return false;
        }).slice(0, 2).map((ad: any) => ({
          name: ad.name || ad.ad_name,
          cpl: ad.cpl,
          cpp: ad.cpp,
          roas: ad.roas,
        })),
      });
    }

    // Fetch previous report for week-over-week context
    const { data: previousReports } = await supabase
      .from('weekly_reports')
      .select('report_text, metrics_snapshot, recommendations_snapshot, campaign_statuses, date_range_start, date_range_end')
      .eq('brand_id', brandId)
      .order('date_range_end', { ascending: false })
      .limit(1);

    const previousReport = previousReports?.[0] || null;
    const prevSnapshot = previousReport?.metrics_snapshot as any;

    // Build week-over-week context
    let wowContext = '';
    if (prevSnapshot && typeof prevSnapshot === 'object') {
      wowContext = `\n\nPREVIOUS REPORT (${previousReport.date_range_start} to ${previousReport.date_range_end}):\n`;
      const prevCampaigns = Object.entries(prevSnapshot);
      for (const [name, data] of prevCampaigns) {
        const d = data as any;
        wowContext += `- ${name}: CPL=$${d.cpl || '—'}, CPP=$${d.cpp || '—'}, ROAS=${d.roas || '—'}x, Spend=$${d.spend || '—'}\n`;
      }
      wowContext += '\nPREVIOUS RECOMMENDATIONS:\n';
      const prevRecs = (previousReport.recommendations_snapshot as any[]) || [];
      prevRecs.forEach((r: any) => {
        wowContext += `- ${r}\n`;
      });
    }

    // Build the AI prompt
    const prompt = `You are a Meta Ads strategist writing a weekly performance report for a client.
Generate a clean, copy-paste-ready weekly report in plain text format (no markdown headers, no HTML).

REPORT FORMAT (follow this exactly):

Line 1: Weekly Report for ${dateRangeStart || 'the selected period'} – ${dateRangeEnd || ''}

Then the legend:
✅ Meeting or exceeding the goal, potential for scaling
⚠️ Needs intervention, next steps listed
👀 Watching closely, need more data before intervening
❌ Turned off, new plan listed

Then for EACH campaign, a section like:
[STATUS EMOJI] [Objective] – [Campaign Name]

[Primary KPI]: $X.XX (Goal: <$X or Xx)
Total [Leads/Purchases/etc]: XX

Note(s):
[2-4 sentences about performance, mentioning specific creative names if available]
[Specific creative callouts with metrics]
[What action we're taking or watching]

After all campaigns:

--- Daily Budgets ---
[Campaign Name]: ~$XX/day
...
Total: ~$XXX/day

Total Ad Spend for reporting period: ~$X,XXX.XX
Total Ad Revenue for reporting period: ~$X,XXX.XX

Final Note(s):
[2-3 sentences of strategic summary — what's working, what's the main watch point, overall account health]

RULES:
- Assign status emojis based on: ✅ if primary KPI meets/beats goal, ⚠️ if 10-30% above goal or declining, 👀 if not enough data or borderline, ❌ if turned off
- If a campaign has no goal set, use industry benchmarks (CPL<$5, CPP<$70, ROAS>1x)
- Include specific creative names when available
- Be warm but professional — this goes to real clients
- Include week-over-week comparisons if previous data is available
- If a campaign has 0 conversions, note it matter-of-factly and state next steps
- Keep notes concise — max 4 lines per campaign
- Use "~" for approximate values

CAMPAIGN DATA:
${JSON.stringify(campaignSummaries, null, 2)}

Total Spend: $${totalSpend.toFixed(2)}
Total Revenue: $${totalRevenue.toFixed(2)}
${wowContext}

Generate ONLY the report text, nothing else. No preamble, no "Here's your report" — just the report itself.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('AI service not configured');

    let reportText = '';
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a professional Meta Ads strategist. Write clear, actionable weekly reports.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (aiResponse.status === 429) {
          throw new Error('Rate limited — please try again in a moment.');
        }
        if (aiResponse.status === 402) {
          throw new Error('AI credits exhausted — please add credits to continue.');
        }
        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error('AI gateway error:', aiResponse.status, errText);
          if (retries < maxRetries) {
            retries++;
            await new Promise(r => setTimeout(r, 1000 * retries));
            continue;
          }
          throw new Error('AI generation failed');
        }

        const aiData = await aiResponse.json();
        reportText = aiData.choices?.[0]?.message?.content || '';
        break;
      } catch (err: any) {
        if (err.message.includes('Rate limited') || err.message.includes('credits')) throw err;
        if (retries < maxRetries) {
          retries++;
          await new Promise(r => setTimeout(r, 1000 * retries));
          continue;
        }
        throw err;
      }
    }

    if (!reportText) throw new Error('Failed to generate report');

    // Build metrics snapshot for historical tracking
    const metricsSnapshot: Record<string, any> = {};
    const campaignStatuses: Record<string, string> = {};
    const recommendationsList: string[] = [];

    for (const cs of campaignSummaries) {
      metricsSnapshot[cs.name] = {
        spend: cs.metrics.spend,
        cpl: cs.metrics.cpl,
        cpp: cs.metrics.cpp,
        roas: cs.metrics.roas,
        leads: cs.metrics.leads,
        purchases: cs.metrics.purchases,
        ctr: cs.metrics.ctr,
        frequency: cs.metrics.frequency,
        dailyBudget: cs.dailyBudget,
        userGoal: cs.userGoal,
        primaryKPI: cs.primaryKPI,
        primaryValue: cs.primaryValue,
      };

      // Determine status emoji
      if (cs.status !== 'ACTIVE') {
        campaignStatuses[cs.name] = '❌';
      } else if (cs.userGoal && cs.primaryValue) {
        const isLowerBetter = cs.primaryKPI === 'cpl' || cs.primaryKPI === 'cpp' || cs.primaryKPI === 'costPerThruPlay';
        if (isLowerBetter) {
          campaignStatuses[cs.name] = cs.primaryValue <= cs.userGoal ? '✅' : cs.primaryValue <= cs.userGoal * 1.3 ? '⚠️' : '👀';
        } else {
          campaignStatuses[cs.name] = cs.primaryValue >= cs.userGoal ? '✅' : cs.primaryValue >= cs.userGoal * 0.7 ? '⚠️' : '👀';
        }
      } else {
        campaignStatuses[cs.name] = '👀';
      }
    }

    // Extract recommendations from report text (lines that mention action items)
    const lines = reportText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.toLowerCase().includes('we will') ||
        trimmed.toLowerCase().includes('we\'ll') ||
        trimmed.toLowerCase().includes('consider') ||
        trimmed.toLowerCase().includes('recommend') ||
        trimmed.toLowerCase().includes('refresh') ||
        trimmed.toLowerCase().includes('monitor') ||
        trimmed.toLowerCase().includes('scale')
      ) {
        if (trimmed.length > 10 && trimmed.length < 200) {
          recommendationsList.push(trimmed);
        }
      }
    }

    // Save report to weekly_reports table (service role bypasses RLS for insert)
    const { error: insertError } = await supabase
      .from('weekly_reports')
      .insert({
        brand_id: brandId,
        date_range_start: dateRangeStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        date_range_end: dateRangeEnd || new Date().toISOString().split('T')[0],
        report_text: reportText,
        metrics_snapshot: metricsSnapshot,
        recommendations_snapshot: recommendationsList,
        campaign_statuses: campaignStatuses,
      });

    if (insertError) {
      console.error('Failed to save report:', insertError);
      // Don't fail the whole request — still return the report
    }

    return new Response(
      JSON.stringify({ success: true, report: reportText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error generating client report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
