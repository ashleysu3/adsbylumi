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
      .select('id, name, user_id, meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();
    if (brandError || !brand) throw new Error('Brand not found');
    if (brand.user_id !== user.id) throw new Error('Access denied');

    // Fetch all campaign workspaces with meta_campaign_ids
    const { data: workspaces, error: wsError } = await supabase
      .from('campaign_workspaces')
      .select(`
        id, name, meta_campaign_ids, meta_campaign_status,
        final_answers, campaign_builder_answers, template_id, offer_name,
        published_at, performance_report_latest,
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

    if (selectedWorkspaceIds && Array.isArray(selectedWorkspaceIds) && selectedWorkspaceIds.length > 0) {
      campaigns = campaigns.filter((w: any) => selectedWorkspaceIds.includes(w.id));
    }

    if (campaigns.length === 0) {
      throw new Error('No published campaigns found for the selected campaigns');
    }

    // ====================================================
    // FETCH LIVE META DATA for each campaign (same as dashboard)
    // ====================================================
    const metaAccessToken = brand.meta_access_token;
    const safeJson = async (response: Response): Promise<any> => {
      const text = await response.text();
      if (!text || !text.trim()) return {};
      try { return JSON.parse(text); } catch { return {}; }
    };

    const campaignSummaries: any[] = [];
    let totalSpend = 0;
    let totalRevenue = 0;

    // Fetch campaign goals
    const { data: goalsData } = await supabase
      .from('campaign_goals')
      .select('*')
      .eq('brand_id', brandId);
    const goalsMap: Record<string, any> = {};
    (goalsData || []).forEach((g: any) => {
      if (g.workspace_id) goalsMap[g.workspace_id] = g;
    });

    for (const ws of campaigns) {
      const metaCampaignIds = ws.meta_campaign_ids as any;
      let campaignId = metaCampaignIds?.campaignId;
      const finalAnswers = ws.final_answers as any;
      const template = ws.campaign_templates as any;
      const objective = template?.objective || 'unknown';
      const templateName = template?.name || '';
      const builderAnswers = ws.campaign_builder_answers as any;

      // Get user goal from campaign_goals table
      const goalRow = goalsMap[ws.id];
      const userGoal = goalRow?.primary_kpi_threshold || finalAnswers?.userKpiGoal || null;

      let liveMetrics: any = {};
      let status = ((ws.meta_campaign_status || 'unknown') as string).toUpperCase();
      let dailyBudget = builderAnswers?.budget || null;
      let adBreakdown: any[] = [];

      // Try fetching live data from Meta API
      if (metaAccessToken && campaignId) {
        // Clean campaign ID
        if (typeof campaignId === 'string' && campaignId.includes('_')) {
          const parts = campaignId.split('_');
          const numericPart = parts[parts.length - 1];
          const timestamp = parseInt(numericPart);
          const now = Date.now();
          const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
          if (timestamp > oneYearAgo && timestamp <= now) {
            campaignId = null; // placeholder ID
          } else {
            campaignId = numericPart;
          }
        }

        if (campaignId && /^\d+$/.test(campaignId)) {
          try {
            // Fetch campaign status + budget
            const statusUrl = `https://graph.facebook.com/v18.0/${campaignId}?fields=status,effective_status,daily_budget,lifetime_budget&access_token=${metaAccessToken}`;
            const statusResp = await fetch(statusUrl);
            const statusData = await safeJson(statusResp);
            if (!statusData.error) {
              status = (statusData.effective_status || statusData.status || status).toUpperCase();
              if (statusData.daily_budget) dailyBudget = Number(statusData.daily_budget) / 100;
            }

            // Fetch insights for date range
            const since = dateRangeStart || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            const until = dateRangeEnd || new Date().toISOString().split('T')[0];
            const fields = 'spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,purchase_roas';
            const insightsUrl = `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&access_token=${metaAccessToken}`;
            const insightsResp = await fetch(insightsUrl);
            const insightsData = await safeJson(insightsResp);

            if (insightsData.data && insightsData.data.length > 0) {
              const d = insightsData.data[0];
              const actions = d.actions || [];
              const costPerAction = d.cost_per_action_type || [];

              const getAction = (type: string) => {
                const a = actions.find((a: any) => a.action_type === type);
                return a ? Number(a.value) : 0;
              };
              const getCostPerAction = (type: string) => {
                const c = costPerAction.find((c: any) => c.action_type === type);
                return c ? Number(c.value) : null;
              };

              const leads = getAction('lead') || getAction('onsite_conversion.lead_grouped') || getAction('offsite_conversion.fb_pixel_lead');
              const purchases = getAction('purchase') || getAction('offsite_conversion.fb_pixel_purchase');
              const linkClicks = getAction('link_click');
              const videoViews = getAction('video_view');
              const thruPlays = getAction('onsite_conversion.messaging_first_reply') || getAction('video_view'); // approximation
              const roas = d.purchase_roas?.[0]?.value ? Number(d.purchase_roas[0].value) : null;

              liveMetrics = {
                spend: Number(d.spend || 0),
                impressions: Number(d.impressions || 0),
                clicks: Number(d.clicks || 0),
                ctr: Number(d.ctr || 0),
                cpc: Number(d.cpc || 0),
                reach: Number(d.reach || 0),
                frequency: Number(d.frequency || 0),
                leads,
                purchases,
                cpl: getCostPerAction('lead') || getCostPerAction('onsite_conversion.lead_grouped') || getCostPerAction('offsite_conversion.fb_pixel_lead'),
                cpp: getCostPerAction('purchase') || getCostPerAction('offsite_conversion.fb_pixel_purchase'),
                roas,
                linkClicks,
                videoViews,
              };
            }

            // Fetch ad-level breakdown
            const adFields = 'ad_name,ad_id,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,purchase_roas';
            const adUrl = `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=${adFields}&level=ad&time_range={"since":"${since}","until":"${until}"}&limit=20&access_token=${metaAccessToken}`;
            const adResp = await fetch(adUrl);
            const adData = await safeJson(adResp);
            if (adData.data) {
              adBreakdown = adData.data.map((ad: any) => {
                const adActions = ad.actions || [];
                const adCPA = ad.cost_per_action_type || [];
                const getAdAction = (t: string) => { const a = adActions.find((a: any) => a.action_type === t); return a ? Number(a.value) : 0; };
                const getAdCost = (t: string) => { const c = adCPA.find((c: any) => c.action_type === t); return c ? Number(c.value) : null; };
                return {
                  name: ad.ad_name,
                  spend: Number(ad.spend || 0),
                  impressions: Number(ad.impressions || 0),
                  clicks: Number(ad.clicks || 0),
                  ctr: Number(ad.ctr || 0),
                  leads: getAdAction('lead') || getAdAction('onsite_conversion.lead_grouped'),
                  purchases: getAdAction('purchase'),
                  cpl: getAdCost('lead') || getAdCost('onsite_conversion.lead_grouped'),
                  cpp: getAdCost('purchase'),
                  roas: ad.purchase_roas?.[0]?.value ? Number(ad.purchase_roas[0].value) : null,
                };
              }).filter((ad: any) => ad.spend > 0).sort((a: any, b: any) => b.spend - a.spend);
            }
          } catch (metaErr) {
            console.error(`Meta API error for ${ws.name}:`, metaErr);
            // Fall back to stored data
            const report = ws.performance_report_latest as any;
            if (report?.metrics) liveMetrics = report.metrics;
            if (report?.ad_breakdown) adBreakdown = report.ad_breakdown;
          }
        }
      }

      // If no live metrics, fall back to stored report
      if (!liveMetrics.spend && liveMetrics.spend !== 0) {
        const report = ws.performance_report_latest as any;
        if (report?.metrics) liveMetrics = report.metrics;
        if (report?.ad_breakdown) adBreakdown = report.ad_breakdown || [];
      }

      const metrics = liveMetrics;
      const spend = Number(metrics.spend || 0);
      const revenue = Number(metrics.roas || 0) * spend;
      totalSpend += spend;
      totalRevenue += revenue;

      // Determine primary KPI
      let primaryKPI = 'cpl';
      let primaryValue: number | null = null;
      const nameLC = (ws.name || '').toLowerCase();
      const objLC = objective.toLowerCase();

      if (objLC.includes('sale') || objLC.includes('purchase') || nameLC.includes('sale')) {
        primaryKPI = 'cpp'; primaryValue = metrics.cpp || null;
      } else if (objLC.includes('lead') || nameLC.includes('lead')) {
        primaryKPI = 'cpl'; primaryValue = metrics.cpl || null;
      } else if (objLC.includes('video') || nameLC.includes('video')) {
        primaryKPI = 'costPerThruPlay'; primaryValue = metrics.costPerThruPlay || null;
      }

      // Determine performance status
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

      // Fatigue signals
      const fatigueSignals: string[] = [];
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
          name: ad.name,
          spend: ad.spend,
          results: ad.leads || ad.purchases || 0,
          cpl: ad.cpl,
          cpp: ad.cpp,
          roas: ad.roas,
          ctr: ad.ctr,
        })),
        underperformers: adBreakdown.filter((ad: any) => {
          if (primaryKPI === 'cpl' && userGoal && ad.cpl && ad.cpl > userGoal * 1.3) return true;
          if (primaryKPI === 'cpp' && userGoal && ad.cpp && ad.cpp > userGoal * 1.3) return true;
          return false;
        }).slice(0, 2).map((ad: any) => ({
          name: ad.name,
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
      prevRecs.forEach((r: any) => { wowContext += `- ${r}\n`; });
    }

    const campaignNames = campaignSummaries.map(c => c.name);

    const prompt = `You are LUMI, an elite Meta Ads strategist. You write weekly performance reports for clients with confidence, specificity, and warmth. You never hedge with "we'll look into it" — you state what is happening, why, and exactly what you're doing about it.

IMPORTANT: This is LIVE data pulled directly from Meta's API for the period ${dateRangeStart || 'last 7 days'} to ${dateRangeEnd || 'today'}. Use the exact numbers provided — do NOT make up or estimate metrics.

CRITICAL: You MUST include a section for EVERY one of these campaigns: ${campaignNames.map(n => `"${n}"`).join(', ')}.

FORMAT RULES (follow exactly — use markdown formatting):

**Weekly Performance Report**
${dateRangeStart || 'Last 7 days'} – ${dateRangeEnd || 'Today'}

---

**Status Key:**
✅ Meeting/exceeding goal — scaling opportunity
⚠️ Needs intervention — next steps listed
👀 Monitoring closely — check-in date listed
❌ Paused — replacement plan noted

---

Then for EACH campaign, use this exact structure:

### [STATUS EMOJI] [Campaign Name]
**Objective:** [Objective] | **Template:** [Template Name]

| Metric | Value |
|--------|-------|
| **Spend** | $X,XXX.XX |
| **[Primary KPI]** | $X.XX (Goal: $X.XX) |
| **Results** | XX [leads/purchases/views] |
| **CTR** | X.XX% |
| **CPC** | $X.XX |
| **Frequency** | X.X |
| **Reach** | XX,XXX |
| **Daily Budget** | ~$XX/day |

**Analysis:**
[2-4 sentences with specific diagnosis. Name specific creatives when available.]

**Next Step:**
[Concrete action with timeline — never "we'll look into it"]

---

After all campaigns:

### 💰 Budget Summary

| Campaign | Daily Budget |
|----------|-------------|
| [Name] | ~$XX/day |
| **Total** | **~$XXX/day** |

**Total Ad Spend:** $X,XXX.XX
**Total Revenue:** $X,XXX.XX

---

### 📊 Strategic Summary
[3-4 sentences of high-level account health. What's the trajectory? What's the #1 priority? Frame wins confidently.]

DECISION TREE FOR EACH CAMPAIGN:
1. **MEETING GOAL**: State clearly this is performing well. Recommend scaling 15-20%. Cite specific KPI vs goal.
2. **SLIGHTLY ABOVE GOAL**: Diagnose likely cause with specificity. State concrete next step with timeline.
3. **SIGNIFICANTLY ABOVE GOAL**: Be direct but reassuring. If fatigue signals exist, name the fix. Give specific fallback date.
4. **NO CONVERSIONS**: Explain this is normal in first 3-7 days. Reference supporting metrics. Give check-in date.
5. **PAUSED**: State why. State replacement plan.
6. **WATCHING**: State what signals you're monitoring and when you'll have enough data.

FATIGUE: If fatigueSignals exist, address them directly.

TONE: Confident, warm, direct. Never say "we'll look into it" or "hoping to see". Say "we're monitoring X daily" and "if X doesn't improve by [date], we will Y".

CAMPAIGN DATA:
${JSON.stringify(campaignSummaries, null, 2)}

Total Spend: $${totalSpend.toFixed(2)}
Total Revenue: $${totalRevenue.toFixed(2)}
${wowContext}

Generate ONLY the report text. No preamble.`;

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
              { role: 'system', content: 'You are LUMI, an elite Meta Ads strategist. Write with confidence, specificity, and warmth. Use markdown formatting for structure. Every recommendation includes exact action, metric, and timeline.' },
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

    // Post-generation validation
    const missingCampaigns = campaignNames.filter(name => !reportText.includes(name));
    if (missingCampaigns.length > 0) {
      reportText += `\n\n---\n\n### Additional Campaigns\n`;
      for (const name of missingCampaigns) {
        const cs = campaignSummaries.find(c => c.name === name);
        if (cs) {
          reportText += `\n#### 👀 ${name}\n**Status:** ${cs.status} | **Primary KPI (${cs.primaryKPI}):** ${cs.primaryValue ? `$${cs.primaryValue}` : 'Insufficient data'}\n\nData for this campaign is being collected. Actionable insights in the next reporting period.\n`;
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
