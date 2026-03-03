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

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { brandId, dateRangeStart, dateRangeEnd, selectedWorkspaceIds } = await req.json();
    if (!brandId) throw new Error('brandId is required');

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
    let campaigns = (workspaces || []).filter((w: any) => {
      const campaignId = w.meta_campaign_ids?.campaignId;
      if (!campaignId) return false;
      if (w.meta_campaign_status === 'draft') return false;
      return true;
    });

    // If selectedWorkspaceIds provided, filter to only those
    if (selectedWorkspaceIds && Array.isArray(selectedWorkspaceIds) && selectedWorkspaceIds.length > 0) {
      campaigns = campaigns.filter((w: any) => selectedWorkspaceIds.includes(w.id));
    }

    if (campaigns.length === 0) {
      throw new Error('No published campaigns found for the selected campaigns');
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

      // Determine performance status for decision tree
      let performanceStatus = 'watching';
      if (status !== 'ACTIVE') {
        performanceStatus = 'paused';
      } else if (userGoal && primaryValue) {
        const isLowerBetter = ['cpl', 'cpp', 'costPerThruPlay'].includes(primaryKPI);
        if (isLowerBetter) {
          if (primaryValue <= userGoal) performanceStatus = 'meeting_goal';
          else if (primaryValue <= userGoal * 1.3) performanceStatus = 'slightly_above';
          else performanceStatus = 'significantly_above';
        } else {
          if (primaryValue >= userGoal) performanceStatus = 'meeting_goal';
          else if (primaryValue >= userGoal * 0.7) performanceStatus = 'slightly_above';
          else performanceStatus = 'significantly_above';
        }
      } else if (metrics.leads === 0 && metrics.purchases === 0 && spend > 0) {
        performanceStatus = 'no_conversions';
      }

      // Week-over-week trend from history
      let weekOverWeekTrend = null;
      if (history.length >= 2) {
        const prev = history[history.length - 2]?.metrics || {};
        if (primaryKPI === 'cpl' && prev.cpl && metrics.cpl) {
          weekOverWeekTrend = { metric: 'CPL', previous: prev.cpl, current: metrics.cpl, change: ((metrics.cpl - prev.cpl) / prev.cpl * 100).toFixed(1) };
        } else if (primaryKPI === 'cpp' && prev.cpp && metrics.cpp) {
          weekOverWeekTrend = { metric: 'CPP', previous: prev.cpp, current: metrics.cpp, change: ((metrics.cpp - prev.cpp) / prev.cpp * 100).toFixed(1) };
        }
      }

      // Get ad-level breakdown from performance_report_latest
      const report = ws.performance_report_latest as any;
      const adBreakdown = report?.ad_breakdown || [];

      // Fatigue signals
      const fatigueSignals = [];
      if (metrics.frequency && metrics.frequency >= 4) fatigueSignals.push(`Frequency at ${metrics.frequency.toFixed(1)} (threshold: 4)`);
      if (metrics.ctr && metrics.ctr < 0.8) fatigueSignals.push(`CTR at ${metrics.ctr.toFixed(2)}% (below 0.8% floor)`);

      campaignSummaries.push({
        name: ws.name,
        objective,
        templateName,
        status,
        performanceStatus,
        primaryKPI,
        primaryValue,
        userGoal,
        dailyBudget,
        weekOverWeekTrend,
        fatigueSignals,
        daysSinceLaunch: ws.published_at ? Math.ceil((Date.now() - new Date(ws.published_at).getTime()) / 86400000) : null,
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

    let wowContext = '';
    if (prevSnapshot && typeof prevSnapshot === 'object') {
      wowContext = `\n\nPREVIOUS REPORT (${previousReport.date_range_start} to ${previousReport.date_range_end}):\n`;
      const prevCampaigns = Object.entries(prevSnapshot);
      for (const [name, data] of prevCampaigns) {
        const d = data as any;
        wowContext += `- ${name}: CPL=$${d.cpl || '—'}, CPP=$${d.cpp || '—'}, ROAS=${d.roas || '—'}x, Spend=$${d.spend || '—'}\n`;
      }
      wowContext += '\nPREVIOUS RECOMMENDATIONS (report on whether these were followed and their outcome):\n';
      const prevRecs = (previousReport.recommendations_snapshot as any[]) || [];
      prevRecs.forEach((r: any) => {
        wowContext += `- ${r}\n`;
      });
    }

    // Build the campaign names list for validation
    const campaignNames = campaignSummaries.map(c => c.name);

    const prompt = `You are LUMI, an elite Meta Ads strategist who has managed over $50M in ad spend. You write weekly performance reports for clients with confidence, specificity, and warmth. You never hedge with "we'll look into it" — you always state what is happening, why, and exactly what you're doing about it.

CRITICAL RULES FOR EVERY CAMPAIGN SECTION:
You MUST include a dedicated section for EVERY one of these campaigns: ${campaignNames.map(n => `"${n}"`).join(', ')}. Missing even one is unacceptable.

For each campaign, follow this decision tree to determine your diagnosis and recommendation:

DECISION TREE:
1. **MEETING GOAL (performanceStatus = "meeting_goal")**: State clearly this is performing well. Recommend scaling budget by 15-20% to capture more volume at this efficient cost. Cite the specific KPI and how it compares to goal. Example: "CPL is $3.42 against a $5.00 goal — this is strong. We recommend increasing daily budget from $XX to $XX to capture more leads at this efficient rate."

2. **SLIGHTLY ABOVE GOAL (performanceStatus = "slightly_above")**: Diagnose the likely cause with specificity (creative fatigue if frequency is high, audience saturation if reach is plateauing, seasonal shifts if it's a known period). State the concrete next step: "We are swapping in creative variant [name] / broadening the interest stack / adjusting the daily budget from $XX to $XX." Give a timeline: "We expect this to bring CPL back under goal within 3-5 days."

3. **SIGNIFICANTLY ABOVE GOAL (performanceStatus = "significantly_above")**: Be direct but reassuring. If fatigue signals exist, say so and name the fix. If it's a newer campaign, explain the optimization window. Always state: "If we don't see improvement by [specific date], we will [specific fallback: pause and relaunch with new creative / restructure the audience / shift budget to the performing campaign]."

4. **NO CONVERSIONS YET (performanceStatus = "no_conversions")**: Explain this is normal in the first 3-7 days. Reference the supporting metrics: "CTR is X% which is [healthy/below threshold] and CPC is $X.XX which is [competitive/elevated]. These signals tell us [the creative is resonating but the landing page may need optimization / the algorithm is still learning / we need to give it more time]." Give a specific check-in date.

5. **PAUSED/OFF (performanceStatus = "paused")**: State why it was paused (performance, budget reallocation, testing cycle). State the replacement plan.

6. **WATCHING (performanceStatus = "watching")**: Not enough data to make a call. State what specific signals you're monitoring (CTR, CPC, frequency) and when you'll have enough data to act. Frame this as strategic patience, not uncertainty.

FATIGUE SIGNALS: If a campaign has fatigueSignals, you MUST address them. High frequency means creative fatigue — name the specific creative swap or refresh plan. Low CTR means the message isn't landing — state what you'd change.

WEEK-OVER-WEEK: If weekOverWeekTrend data exists, reference it: "CPL moved from $X.XX to $X.XX (+X%), which [is within normal fluctuation / signals we need to act]."

PREVIOUS RECOMMENDATIONS: If previous recommendations are provided, report on their outcome. "Last week we recommended [X]. [This has been implemented and we're seeing Y / This is in progress / This needs to be prioritized this week]."

REPORT FORMAT (follow exactly):

Line 1: Weekly Report for ${dateRangeStart || 'the selected period'} – ${dateRangeEnd || ''}

Legend:
✅ Meeting or exceeding goal — scaling opportunity
⚠️ Needs intervention — next steps listed below
👀 Monitoring closely — specific check-in date listed
❌ Paused — replacement plan noted

Then for EACH campaign:
[STATUS EMOJI] [Objective] – [Campaign Name]

[Primary KPI]: $X.XX (Goal: <$X or Xx)
Total [Leads/Purchases/etc]: XX

Analysis:
[2-4 sentences with specific diagnosis following the decision tree above]
[Name specific creatives when available — "The top performer is [creative name] at $X.XX CPL"]
[Concrete next step with timeline — never "we'll look into it"]

After all campaigns:

--- Daily Budgets ---
[Campaign Name]: ~$XX/day
...
Total: ~$XXX/day

Total Ad Spend: ~$X,XXX.XX
Total Revenue: ~$X,XXX.XX

Strategic Summary:
[3-4 sentences of high-level account health. What's the overall trajectory? What's the #1 priority this week? Frame wins confidently and challenges as solvable with a clear plan.]

TONE RULES:
- Write as someone who has seen thousands of ad accounts — confident, warm, direct
- When recommending patience, always pair it with the specific signals you're watching and the date you'll reassess
- Never use: "we'll look into it", "we'll keep an eye on", "hoping to see", "fingers crossed"
- Instead use: "we're monitoring CTR and CPC daily", "if X doesn't improve by [date], we will Y", "our next move is"
- Celebrate wins genuinely: "This is exactly what we want to see" / "This campaign is doing the heavy lifting"
- Frame challenges as expertise: "This is a common pattern at this stage — here's how we address it"

CAMPAIGN DATA:
${JSON.stringify(campaignSummaries, null, 2)}

Total Spend: $${totalSpend.toFixed(2)}
Total Revenue: $${totalRevenue.toFixed(2)}
${wowContext}

Generate ONLY the report text, nothing else. No preamble — just the report itself.`;

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
              { role: 'system', content: 'You are LUMI, an elite Meta Ads strategist. You write with confidence, specificity, and warmth. Every recommendation includes the exact action, metric, and timeline. You never hedge.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (aiResponse.status === 429) throw new Error('Rate limited — please try again in a moment.');
        if (aiResponse.status === 402) throw new Error('AI credits exhausted — please add credits to continue.');
        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error('AI gateway error:', aiResponse.status, errText);
          if (retries < maxRetries) { retries++; await new Promise(r => setTimeout(r, 1000 * retries)); continue; }
          throw new Error('AI generation failed');
        }

        const aiData = await aiResponse.json();
        reportText = aiData.choices?.[0]?.message?.content || '';
        break;
      } catch (err: any) {
        if (err.message.includes('Rate limited') || err.message.includes('credits')) throw err;
        if (retries < maxRetries) { retries++; await new Promise(r => setTimeout(r, 1000 * retries)); continue; }
        throw err;
      }
    }

    if (!reportText) throw new Error('Failed to generate report');

    // Post-generation validation: check every selected campaign appears
    const missingCampaigns = campaignNames.filter(name => !reportText.includes(name));
    if (missingCampaigns.length > 0) {
      reportText += `\n\n--- Additional Campaigns ---\n`;
      for (const name of missingCampaigns) {
        const cs = campaignSummaries.find(c => c.name === name);
        if (cs) {
          reportText += `\n👀 ${cs.objective} – ${name}\nStatus: ${cs.status} | Primary KPI (${cs.primaryKPI}): ${cs.primaryValue ? `$${cs.primaryValue}` : 'Insufficient data'}\nNote: Data for this campaign is being collected. We will have actionable insights in the next reporting period.\n`;
        }
      }
    }

    // Build metrics snapshot for historical tracking
    const metricsSnapshot: Record<string, any> = {};
    const campaignStatuses: Record<string, string> = {};
    const recommendationsList: string[] = [];

    for (const cs of campaignSummaries) {
      metricsSnapshot[cs.name] = {
        spend: cs.metrics.spend, cpl: cs.metrics.cpl, cpp: cs.metrics.cpp,
        roas: cs.metrics.roas, leads: cs.metrics.leads, purchases: cs.metrics.purchases,
        ctr: cs.metrics.ctr, frequency: cs.metrics.frequency, dailyBudget: cs.dailyBudget,
        userGoal: cs.userGoal, primaryKPI: cs.primaryKPI, primaryValue: cs.primaryValue,
      };

      if (cs.status !== 'ACTIVE') {
        campaignStatuses[cs.name] = '❌';
      } else if (cs.performanceStatus === 'meeting_goal') {
        campaignStatuses[cs.name] = '✅';
      } else if (cs.performanceStatus === 'slightly_above') {
        campaignStatuses[cs.name] = '⚠️';
      } else {
        campaignStatuses[cs.name] = '👀';
      }
    }

    // Extract recommendations from report text
    const lines = reportText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        (trimmed.toLowerCase().includes('we will') || trimmed.toLowerCase().includes('we\'ll') ||
         trimmed.toLowerCase().includes('we recommend') || trimmed.toLowerCase().includes('our next move') ||
         trimmed.toLowerCase().includes('we are') || trimmed.toLowerCase().includes('we\'re monitoring') ||
         trimmed.toLowerCase().includes('scaling') || trimmed.toLowerCase().includes('swapping'))
        && trimmed.length > 10 && trimmed.length < 200
      ) {
        recommendationsList.push(trimmed);
      }
    }

    // Save report
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

    if (insertError) console.error('Failed to save report:', insertError);

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
