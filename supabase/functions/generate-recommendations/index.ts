import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recommendation {
  id: string;
  type: 'budget_increase' | 'budget_decrease' | 'pause_ad' | 'resume_ad' | 'swap_creative' | 'keep_running' | 'create_creative';
  title: string;
  description: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
  requiresDoubleApproval: boolean;
  actionPayload: Record<string, any>;
  priority: number;
  userAction?: boolean;
  actionUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, brandId, metrics, ads, goals } = await req.json();

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Missing workspaceId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch workspace to get brand thresholds and bench items
    const { data: workspace } = await supabase
      .from('campaign_workspaces')
      .select('*, brands(name, alert_thresholds, notification_preferences)')
      .eq('id', workspaceId)
      .single();

    const alertThresholds = (workspace?.brands as any)?.alert_thresholds || {};
    const creativeAutomation = (workspace?.brands as any)?.notification_preferences?.creative_automation || {};
    const defaultFrequencyThreshold = creativeAutomation.fatigue_threshold || alertThresholds.frequency_warning || 4;

    // Fetch bench items for creative swap recommendations
    const { data: benchItems } = await supabase
      .from('creative_bench')
      .select('id, meta_ad_id, status, auto_rotate_approved')
      .eq('workspace_id', workspaceId)
      .eq('status', 'bench')
      .eq('auto_rotate_approved', true);

    const bench = benchItems || [];
    const recommendations: Recommendation[] = [];
    let priority = 0;

    const m = metrics || {};
    const adList: any[] = ads || [];

    // ============================================================
    // GOAL-AWARE THRESHOLDS
    // ============================================================

    const hasGoals = !!goals?.primary_kpi;

    const primaryKpi = goals?.primary_kpi || 'cpl';
    const primaryThreshold = goals?.primary_kpi_threshold ? parseFloat(String(goals.primary_kpi_threshold)) : null;
    const primaryGoalType = goals?.primary_kpi_goal_type || 'less_than';
    const secondaryKpi = goals?.secondary_kpi || null;
    const secondaryThreshold = goals?.secondary_kpi_threshold ? parseFloat(String(goals.secondary_kpi_threshold)) : null;
    const secondaryGoalType = goals?.secondary_kpi_goal_type || 'less_than';
    const frequencyThreshold = goals?.frequency_threshold ? parseFloat(String(goals.frequency_threshold)) : defaultFrequencyThreshold;

    // Map KPI names to actual metric values
    const kpiValueMap: Record<string, number> = {
      cpl: m.cpl || 0,
      cpc: m.cpc || 0,
      cplpv: m.spend > 0 && m.landingPageViews > 0 ? m.spend / m.landingPageViews : 0,
      cppv: 0,
      cp2sc: m.costPerThruPlay || 0,
      roas: m.roas || 0,
      ctr: m.ctr || 0,
      cpm: m.cpm || 0,
      purchases: m.purchases || 0,
    };

    const primaryValue = kpiValueMap[primaryKpi] ?? 0;
    const secondaryValue = secondaryKpi ? (kpiValueMap[secondaryKpi] ?? 0) : null;

    const primaryMet = primaryThreshold !== null
      ? (primaryGoalType === 'less_than' ? primaryValue <= primaryThreshold : primaryValue >= primaryThreshold)
      : null;

    const primaryClose = primaryThreshold !== null
      ? (primaryGoalType === 'less_than'
          ? primaryValue <= primaryThreshold * 1.25
          : primaryValue >= primaryThreshold * 0.75)
      : null;

    const secondaryMet = secondaryThreshold !== null && secondaryValue !== null
      ? (secondaryGoalType === 'less_than' ? secondaryValue <= secondaryThreshold : secondaryValue >= secondaryThreshold)
      : null;

    const frequency = m.frequency || 0;
    const frequencyHigh = frequency >= frequencyThreshold;
    const ctr = m.ctr || 0;
    const reach = m.reach || m.impressions || 0;
    const hasEnoughData = reach >= 1000;
    const spend = m.spend || 0;

    const formatKpiValue = (kpi: string, value: number): string => {
      if (['cpl', 'cpc', 'cplpv', 'cppv', 'cp2sc', 'cpm'].includes(kpi)) return `$${value.toFixed(2)}`;
      if (kpi === 'roas') return `${value.toFixed(1)}x`;
      if (kpi === 'ctr') return `${value.toFixed(2)}%`;
      return String(Math.round(value));
    };

    const formatThreshold = (kpi: string, threshold: number): string => formatKpiValue(kpi, threshold);

    // ============================================================
    // CAMPAIGN-LEVEL RECOMMENDATIONS — goal-aware
    // ============================================================

    if (hasEnoughData && spend > 0) {

      // Primary KPI: meeting goal → scale
      if (hasGoals && primaryMet === true && !frequencyHigh) {
        recommendations.push({
          id: `scale-${workspaceId}`,
          type: 'budget_increase',
          title: 'Scale budget 20% — hitting your goal',
          description: `Your ${primaryKpi.toUpperCase()} is ${formatKpiValue(primaryKpi, primaryValue)}, which beats your goal of ${primaryGoalType === 'less_than' ? 'under' : 'over'} ${formatThreshold(primaryKpi, primaryThreshold!)}. This campaign is ready to scale.`,
          impact: `Capture more results at your current ${primaryKpi.toUpperCase()} efficiency`,
          confidence: 'high',
          requiresDoubleApproval: true,
          actionPayload: { workspaceId, percentageChange: 20, currentBudget: m.dailyBudget },
          priority: priority++,
        });
      }

      // Primary KPI: close to goal → monitor
      if (hasGoals && primaryMet === false && primaryClose === true) {
        recommendations.push({
          id: `close-${workspaceId}`,
          type: 'keep_running',
          title: `${primaryKpi.toUpperCase()} is close — let it run`,
          description: `You're at ${formatKpiValue(primaryKpi, primaryValue)} vs. your goal of ${formatThreshold(primaryKpi, primaryThreshold!)}. You're within 25% — give it 2–3 more days before making changes.`,
          impact: 'Avoid disrupting an optimizing campaign too early',
          confidence: 'medium',
          requiresDoubleApproval: false,
          actionPayload: {},
          priority: priority++,
          userAction: true,
          actionUrl: `/data`,
        });
      }

      // Primary KPI: missing goal badly → diagnose root cause
      if (hasGoals && primaryMet === false && primaryClose === false) {
        if (ctr < 0.01) {
          recommendations.push({
            id: `hook-problem-${workspaceId}`,
            type: 'create_creative',
            title: `${primaryKpi.toUpperCase()} is ${formatKpiValue(primaryKpi, primaryValue)} — hook isn't working`,
            description: `Your goal is ${formatThreshold(primaryKpi, primaryThreshold!)} but you're at ${formatKpiValue(primaryKpi, primaryValue)}. With CTR at ${ctr.toFixed(2)}%, people aren't clicking — the hook and creative aren't grabbing attention. Meta can't optimize to your goal if the click signal is weak.`,
            impact: 'Better creative signals help Meta find the right people faster',
            confidence: 'high',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, brandId },
            userAction: true,
            actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
            priority: priority++,
          });
        } else {
          recommendations.push({
            id: `conversion-problem-${workspaceId}`,
            type: 'keep_running',
            title: `${primaryKpi.toUpperCase()} is ${formatKpiValue(primaryKpi, primaryValue)} — clicks aren't converting`,
            description: `Your goal is ${formatThreshold(primaryKpi, primaryThreshold!)} but you're at ${formatKpiValue(primaryKpi, primaryValue)}. CTR is ${ctr.toFixed(2)}% — people are clicking but not taking action. Try testing new audiences, adjusting your targeting, or pausing your weakest-performing ads to let Meta re-optimize delivery.`,
            impact: 'Better targeting and ad optimization can bring your cost per result to goal',
            confidence: 'high',
            requiresDoubleApproval: false,
            actionPayload: {},
            priority: priority++,
            userAction: true,
            actionUrl: `/data`,
          });
        }
      }

      // No goals set — use heuristic fallbacks
      if (!hasGoals) {
        if (m.roas && m.roas >= 3) {
          recommendations.push({
            id: `roas-scale-${workspaceId}`,
            type: 'budget_increase',
            title: 'Strong ROAS — ready to scale',
            description: `ROAS of ${m.roas.toFixed(1)}x suggests profitable delivery. Set a campaign goal to get more precise guidance, or scale budget 20% to capture more conversions.`,
            impact: 'More budget at current ROAS = more profitable results',
            confidence: 'medium',
            requiresDoubleApproval: true,
            actionPayload: { workspaceId, percentageChange: 20, currentBudget: m.dailyBudget },
            priority: priority++,
          });
        } else if (ctr < 0.008 && reach >= 2000) {
          recommendations.push({
            id: `low-ctr-no-goals-${workspaceId}`,
            type: 'create_creative',
            title: 'Low CTR — creative isn\'t resonating',
            description: `CTR of ${ctr.toFixed(2)}% across ${reach.toLocaleString()} impressions is a signal the hook or creative isn't connecting. Set a campaign goal for sharper analysis, or try new ad angles.`,
            impact: 'A stronger hook can 2–3x your CTR and cut your cost per result',
            confidence: 'medium',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, brandId },
            userAction: true,
            actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
            priority: priority++,
          });
        }
      }

      // ROAS vs CPL mismatch
      if (hasGoals && secondaryKpi === 'roas' && primaryMet === true && secondaryMet === false && secondaryValue !== null) {
        recommendations.push({
          id: `roas-gap-${workspaceId}`,
          type: 'keep_running',
          title: 'CPL is on target — ROAS needs work',
          description: `Your CPL is at goal (${formatKpiValue('cpl', primaryValue)}) but ROAS is ${secondaryValue.toFixed(1)}x vs. your goal of ${secondaryThreshold}x. Your ads are generating leads efficiently. Consider testing a purchase-optimized campaign or adjusting your audience to reach higher-intent buyers.`,
          impact: 'Testing purchase optimization can improve ROAS without changing your lead campaigns',
          confidence: 'high',
          requiresDoubleApproval: false,
          actionPayload: {},
          priority: priority++,
          userAction: true,
          actionUrl: `/data`,
        });
      }

      // Frequency warning — regardless of goal status
      if (frequencyHigh && primaryMet !== false) {
        const availableBench = bench.filter((b: any) => b.auto_rotate_approved && b.meta_ad_id);
        if (availableBench.length > 0) {
          recommendations.push({
            id: `fatigue-bench-${workspaceId}`,
            type: 'swap_creative',
            title: `Frequency ${frequency.toFixed(1)} — swap in bench creative`,
            description: `Your audience has seen these ads ${frequency.toFixed(1)} times on average (goal: under ${frequencyThreshold}). Results are still OK but will drop soon. You have ${availableBench.length} bench ad(s) ready to go.`,
            impact: 'Refreshing creative before fatigue hits prevents performance dip',
            confidence: 'high',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, brandId, benchAdId: availableBench[0].meta_ad_id },
            priority: priority++,
          });
        } else {
          recommendations.push({
            id: `fatigue-create-${workspaceId}`,
            type: 'create_creative',
            title: `Frequency ${frequency.toFixed(1)} — bench is empty, create new creative`,
            description: `Your audience has seen these ads ${frequency.toFixed(1)} times (goal: under ${frequencyThreshold}). No bench creative is ready. Create new ads now before fatigue kills performance.`,
            impact: 'New creative is your fastest lever when frequency is high',
            confidence: 'high',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, brandId },
            userAction: true,
            actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
            priority: priority++,
          });
        }
      }

      if (frequencyHigh && primaryMet === false) {
        recommendations.push({
          id: `fatigue-urgent-${workspaceId}`,
          type: 'create_creative',
          title: `Frequency ${frequency.toFixed(1)} + missing goal — audience is saturated`,
          description: `You're not hitting your ${primaryKpi.toUpperCase()} goal AND frequency is ${frequency.toFixed(1)}. Audience fatigue is compounding your performance issues. Pause the worst-performing ads now and get new creative in immediately.`,
          impact: 'Continuing to run fatigued creative against an overseen audience burns budget',
          confidence: 'high',
          requiresDoubleApproval: false,
          actionPayload: { workspaceId, brandId },
          userAction: true,
          actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
          priority: priority++,
        });
      }

      // Budget burning with no results
      if (spend > 50 && primaryValue === 0 && hasEnoughData) {
        recommendations.push({
          id: `no-results-${workspaceId}`,
          type: 'budget_decrease',
          title: 'Spending with zero results — pause and investigate',
          description: `You've spent $${spend.toFixed(2)} with no ${primaryKpi.toUpperCase()} recorded. This usually means pixel tracking isn't firing correctly, or the landing page has a technical issue. Check your pixel events before spending more.`,
          impact: 'Stop burning budget on untracked spend',
          confidence: 'high',
          requiresDoubleApproval: false,
          actionPayload: { workspaceId, percentageChange: -100, currentBudget: m.dailyBudget },
          priority: priority++,
        });
      }
    }

    // ============================================================
    // AD-LEVEL RECOMMENDATIONS
    // ============================================================

    if (adList.length > 0 && hasEnoughData) {
      const totalAdSpend = adList.reduce((sum: number, ad: any) => sum + (ad.spend || 0), 0);
      const avgCPR = adList.length > 0
        ? adList.reduce((sum: number, ad: any) => sum + (ad.costPerResult || ad.cpl || 0), 0) / adList.length
        : 0;

      for (const ad of adList) {
        const adReach = ad.reach || ad.impressions || 0;
        const adAge = ad.created_time
          ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / (1000 * 60 * 60 * 24))
          : 7;

        if (adReach < 500 || adAge < 3) continue;

        const adCtr = ad.ctr || 0;
        const adFrequency = ad.frequency || 0;
        const adSpend = ad.spend || 0;
        const adCPR = ad.costPerResult || ad.cpl || ad.cpc || 0;

        const campaignCtr = ctr;
        const isLowCtrAd = campaignCtr > 0 && adCtr < campaignCtr * 0.5 && adReach >= 1000;
        const isBudgetHog = totalAdSpend > 0 && (adSpend / totalAdSpend) > 0.2 && avgCPR > 0 && adCPR > avgCPR * 1.5;

        if (ad.status === 'ACTIVE' && isBudgetHog) {
          recommendations.push({
            id: `budget-hog-${ad.id || ad.name}`,
            type: 'pause_ad',
            title: `Pause "${ad.name}" — eating budget, underdelivering`,
            description: `This ad is spending ${((adSpend / totalAdSpend) * 100).toFixed(0)}% of your campaign budget at $${adCPR.toFixed(2)} CPR — ${((adCPR / avgCPR - 1) * 100).toFixed(0)}% worse than your other ads. It's pulling budget away from better performers.`,
            impact: `Redirecting this budget to better ads could cut your overall CPR`,
            confidence: adReach >= 2000 ? 'high' : 'medium',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, adId: ad.id, action: 'pause' },
            priority: priority++,
          });
        } else if (ad.status === 'ACTIVE' && isLowCtrAd) {
          recommendations.push({
            id: `low-ctr-ad-${ad.id || ad.name}`,
            type: 'pause_ad',
            title: `Pause "${ad.name}" — CTR half the campaign average`,
            description: `This ad has ${adCtr.toFixed(2)}% CTR vs. your campaign average of ${campaignCtr.toFixed(2)}%. After ${adReach.toLocaleString()} impressions, that gap is statistically significant. This creative isn't resonating with your audience.`,
            impact: 'Pausing weak ads forces Meta to spend on your better performers',
            confidence: adReach >= 2000 ? 'high' : 'medium',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, adId: ad.id, action: 'pause' },
            priority: priority++,
          });
        }

        if (ad.status === 'ACTIVE' && adFrequency >= frequencyThreshold) {
          const availableBench = bench.filter((b: any) => b.auto_rotate_approved && b.meta_ad_id);
          if (availableBench.length > 0) {
            recommendations.push({
              id: `ad-fatigue-swap-${ad.id || ad.name}`,
              type: 'swap_creative',
              title: `Swap "${ad.name}" — frequency ${adFrequency.toFixed(1)}`,
              description: `This specific ad has a frequency of ${adFrequency.toFixed(1)}. Swap it with bench creative to keep delivery fresh without turning off the whole campaign.`,
              impact: 'Targeted creative refresh maintains momentum without disrupting the campaign',
              confidence: 'high',
              requiresDoubleApproval: false,
              actionPayload: {
                workspaceId,
                brandId,
                fatigueAdId: ad.id,
                benchAdId: availableBench[0].meta_ad_id,
              },
              priority: priority++,
            });
          }
        }

        if (ad.status === 'PAUSED' && adCtr >= 1.5 && adReach >= 1000) {
          recommendations.push({
            id: `resume-${ad.id || ad.name}`,
            type: 'resume_ad',
            title: `Resume "${ad.name}" — had strong CTR`,
            description: `This ad was paused but had ${adCtr.toFixed(2)}% CTR before stopping — that's strong. If it was paused for fatigue reasons and frequency has since reset, it may be worth reactivating.`,
            impact: 'Reactivating a proven creative can quickly restore campaign momentum',
            confidence: 'medium',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, adId: ad.id, action: 'unpause' },
            priority: priority++,
          });
        }
      }
    }

    // Sort: high confidence first, then by priority number
    const confOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => {
      const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
      if (confDiff !== 0) return confDiff;
      return a.priority - b.priority;
    });

    return new Response(JSON.stringify({ success: true, recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('generate-recommendations error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
