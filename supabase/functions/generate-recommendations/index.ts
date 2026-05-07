import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recommendation {
  id: string;
  type:
    | 'budget_increase'
    | 'budget_decrease'
    | 'pause_ad'
    | 'resume_ad'
    | 'swap_creative'
    | 'keep_running'
    | 'create_creative'
    | 'promote_to_scaling' // Testing → Scaling promotion (Layer 1 of #4)
    | 'hold_for_data';     // Post-change state, trending well — don't poke at it (#6)
  title: string;
  description: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
  requiresDoubleApproval: boolean;
  actionPayload: Record<string, any>;
  priority: number;
  userAction?: boolean;
  actionUrl?: string;
  isInfoOnly?: boolean;
}

// Change context derived from ad_action_log + Meta side-by-side trend analysis.
// Returned to the frontend so the campaign card can show a "data settling" chip
// and reason about whether to show certain recs.
interface ChangeContext {
  recentEventsCount: number;
  mostRecentChangeAt: string | null; // ISO timestamp
  hoursSinceMostRecentChange: number | null;
  events: Array<{
    timestamp: string;
    actionType: string;
    source: string;
    summary: string; // human-readable one-liner
  }>;
  trend: {
    // Primary KPI trend: recent 3-day avg vs prior 4-day avg.
    recentAvg: number | null;
    priorAvg: number | null;
    direction: 'improving' | 'degrading' | 'stable' | 'unknown';
    magnitudePct: number | null; // absolute change as percent of prior
  };
  isPostChange: boolean; // recent events + clear trend direction
  summary: string | null; // e.g. "Since your 4 pauses 2 days ago, CPL dropped from $27 → $21"
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

    // Fetch workspace + brand. We need the Meta access token and ad account
    // ID for the Testing→Scaling detection pass at the bottom (it queries
    // Meta for ad-set names, which the client doesn't currently send).
    const { data: workspace } = await supabase
      .from('campaign_workspaces')
      .select('*, brands(name, alert_thresholds, notification_preferences, meta_access_token, meta_account_id)')
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

    // Resolve primaryKpi EARLY — the change-context trend block below needs it.
    // (The full goal-aware block re-resolves these later for clarity.)
    const primaryKpi: string = goals?.primary_kpi || 'cpl';

    // ============================================================
    // CHANGE CONTEXT (#6)
    //
    // Before running any rec rules, assemble a picture of "what's changed
    // on this campaign recently and how is it responding". Two sources:
    //
    //   1) ad_action_log — authoritative record of LUMI-initiated actions
    //      (pauses, budget changes, swaps, promotes).
    //   2) Meta API — daily metrics over the last 7 days, so we can compare
    //      the trailing 3 days against the prior 4 and tell whether the
    //      campaign is improving, degrading, or stable post-change.
    //
    // This context gets passed into rec emission: if a campaign just had
    // a bunch of changes AND is trending well, we suppress "pause more
    // ads" / "raise budget" style aggressive recs and emit a single
    // "hold_for_data" rec instead. Even when we still emit a rec, we
    // enrich its description with the trend so the user sees context.
    // ============================================================

    const CHANGE_LOOKBACK_HOURS = 72;

    const humanizeActionType = (action_type: string): string => {
      return action_type.replace(/_/g, ' ');
    };

    const summarizeEvent = (row: any): string => {
      const t = row.action_type;
      const d = row.action_detail || {};
      if (t === 'paused_ad' || t === 'ad_paused') {
        return d.ad_name ? `Paused "${d.ad_name}"` : 'Paused an ad';
      }
      if (t === 'activated_ad' || t === 'ad_activated') {
        return d.ad_name ? `Activated "${d.ad_name}"` : 'Activated an ad';
      }
      if (t === 'budget_update') {
        const lvl = d.level || 'campaign';
        return `Budget ${lvl === 'adset_targeted' || lvl === 'adset_single' ? 'on ad set' : 'at campaign level'} → $${d.new_budget}/day`;
      }
      if (t === 'promoted_to_scaling') {
        return d.source_ad_name ? `Promoted "${d.source_ad_name}" to Scaling` : 'Promoted an ad to Scaling';
      }
      if (t === 'swap_creative' || t === 'creative_swap') {
        return 'Swapped creative';
      }
      return humanizeActionType(t);
    };

    // Step 1: fetch ad_action_log rows for this workspace in the lookback window.
    const cutoff = new Date(Date.now() - CHANGE_LOOKBACK_HOURS * 3600 * 1000).toISOString();
    const { data: actionRows } = await supabase
      .from('ad_action_log')
      .select('action_type, action_detail, source, meta_entity_id, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    const events: ChangeContext['events'] = (actionRows || []).map((r: any) => ({
      timestamp: r.created_at,
      actionType: r.action_type,
      source: r.source,
      summary: summarizeEvent(r),
    }));

    const mostRecentChangeAt = events.length > 0 ? events[0].timestamp : null;
    const hoursSinceMostRecentChange = mostRecentChangeAt
      ? (Date.now() - new Date(mostRecentChangeAt).getTime()) / (1000 * 60 * 60)
      : null;

    // Step 2: Meta daily-increment call to compute trend.
    //
    // We ask Meta for per-day metrics over the last 7 days, average the
    // primary-KPI field across (a) the last 3 days and (b) the prior 4,
    // and compare. Uses the same primaryKpi already resolved above, so
    // the trend respects the user's goal type.
    const metaTokenForTrend = (workspace?.brands as any)?.meta_access_token;
    const metaCampaignIds = (workspace as any)?.meta_campaign_ids || {};
    const campaignIdForTrend = metaCampaignIds.campaignId;

    let trendRecent: number | null = null;
    let trendPrior: number | null = null;
    let trendDirection: ChangeContext['trend']['direction'] = 'unknown';
    let trendMagnitudePct: number | null = null;

    if (metaTokenForTrend && campaignIdForTrend) {
      try {
        const trendUrl =
          `https://graph.facebook.com/v21.0/${campaignIdForTrend}/insights` +
          `?fields=spend,impressions,clicks,actions,cost_per_action_type,ctr,cpc,cpm,frequency,purchase_roas` +
          `&time_increment=1&date_preset=last_7d&access_token=${encodeURIComponent(metaTokenForTrend)}`;
        const trendResp = await fetch(trendUrl);
        const trendData = await trendResp.json();
        const days: any[] = Array.isArray(trendData?.data) ? trendData.data : [];

        // Helper to extract the primary KPI value from a daily Meta insight row.
        const extractPrimary = (row: any): number | null => {
          if (primaryKpi === 'cpl') {
            const a = (row.cost_per_action_type || []).find((x: any) => x.action_type === 'lead');
            return a ? parseFloat(a.value) || null : null;
          }
          if (primaryKpi === 'cpp') {
            const a = (row.cost_per_action_type || []).find((x: any) => x.action_type === 'purchase');
            return a ? parseFloat(a.value) || null : null;
          }
          if (primaryKpi === 'cpc') return parseFloat(row.cpc) || null;
          if (primaryKpi === 'cpm') return parseFloat(row.cpm) || null;
          if (primaryKpi === 'ctr') return parseFloat(row.ctr) || null;
          if (primaryKpi === 'roas') {
            const r = row.purchase_roas;
            if (Array.isArray(r) && r.length) return parseFloat(r[0].value) || null;
            return null;
          }
          return null;
        };

        const primaryValues: number[] = days
          .map(extractPrimary)
          .filter((v): v is number => typeof v === 'number' && !isNaN(v));

        if (primaryValues.length >= 4) {
          const recentSlice = primaryValues.slice(-3); // last up-to-3 days
          const priorSlice = primaryValues.slice(0, primaryValues.length - 3);
          const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
          trendRecent = avg(recentSlice);
          trendPrior = avg(priorSlice);
          if (trendPrior > 0) {
            const deltaPct = ((trendRecent - trendPrior) / trendPrior) * 100;
            trendMagnitudePct = Math.abs(deltaPct);
            // For cost-based KPIs (cpl, cpp, cpc, cpm), lower is better →
            // a NEGATIVE delta is "improving". ROAS flips that.
            const higherIsBetter = primaryKpi === 'roas';
            const improving = higherIsBetter ? deltaPct > 0 : deltaPct < 0;
            const degrading = higherIsBetter ? deltaPct < 0 : deltaPct > 0;
            if (trendMagnitudePct < 5) trendDirection = 'stable';
            else if (improving) trendDirection = 'improving';
            else if (degrading) trendDirection = 'degrading';
          } else {
            trendDirection = 'stable';
          }
        }
      } catch (err) {
        console.error('change-context trend fetch failed:', err);
      }
    }

    // Step 3: compose changeContext + a human-readable summary.
    const isPostChange =
      events.length > 0 && trendDirection !== 'unknown' && trendDirection !== 'stable';

    const formatKpiVal = (v: number | null | undefined) => {
      if (v === null || v === undefined || isNaN(v)) return '—';
      const currencyKPIs = ['cpc', 'cpm', 'cpl', 'cpp', 'costPerThruPlay'];
      if (currencyKPIs.includes(primaryKpi)) return `$${v.toFixed(2)}`;
      if (primaryKpi === 'roas') return `${v.toFixed(1)}x`;
      return v.toFixed(2);
    };

    let contextSummary: string | null = null;
    if (isPostChange && trendRecent !== null && trendPrior !== null) {
      const eventCountStr = events.length === 1 ? '1 change' : `${events.length} changes`;
      const whenStr = hoursSinceMostRecentChange !== null
        ? hoursSinceMostRecentChange < 24
          ? `${Math.round(hoursSinceMostRecentChange)}h ago`
          : `${Math.round(hoursSinceMostRecentChange / 24)}d ago`
        : 'recently';
      const direction = trendDirection === 'improving' ? 'dropped' : 'rose';
      contextSummary =
        `Since your ${eventCountStr} ${whenStr}, ${primaryKpi.toUpperCase()} ${direction} ` +
        `from ${formatKpiVal(trendPrior)} → ${formatKpiVal(trendRecent)} ` +
        `(${trendDirection === 'improving' ? '-' : '+'}${trendMagnitudePct!.toFixed(0)}%)`;
    } else if (events.length > 0 && !isPostChange) {
      const eventCountStr = events.length === 1 ? '1 recent change' : `${events.length} recent changes`;
      contextSummary = `${eventCountStr} in the last ${CHANGE_LOOKBACK_HOURS}h — data still settling`;
    }

    const changeContext: ChangeContext = {
      recentEventsCount: events.length,
      mostRecentChangeAt,
      hoursSinceMostRecentChange,
      events: events.slice(0, 10), // don't stream back a huge list
      trend: {
        recentAvg: trendRecent,
        priorAvg: trendPrior,
        direction: trendDirection,
        magnitudePct: trendMagnitudePct,
      },
      isPostChange,
      summary: contextSummary,
    };

    // Convenience flags used throughout the rec rule tree.
    const isMeaningfullyImproving = isPostChange && trendDirection === 'improving' && (trendMagnitudePct ?? 0) >= 15;
    const isMeaningfullyDegrading = isPostChange && trendDirection === 'degrading' && (trendMagnitudePct ?? 0) >= 15;


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
    // Build comprehensive KPI value map — must cover every possible goal KPI
    const clicks = m.clicks || m.linkClicks || 0;
    const leads = m.leads || 0;
    const purchases = m.purchases || 0;
    const landingPageViews = m.landingPageViews || 0;
    const videoViews = m.videoViews || 0;
    const conversations = m.conversations || 0;

    const kpiValueMap: Record<string, number> = {
      cpl: m.cpl || 0,
      cpc: m.cpc || (m.spend > 0 && clicks > 0 ? m.spend / clicks : 0),
      cplpv: m.spend > 0 && landingPageViews > 0 ? m.spend / landingPageViews : 0,
      cppv: m.cppv || 0,
      cp2sc: m.costPerThruPlay || m.cp2sc || 0,
      roas: m.roas || 0,
      ctr: m.ctr || 0,
      cpm: m.cpm || 0,
      purchases: purchases,
      // Aliases used in campaign goal configs
      cpl_cpp: m.cpl || m.cpp || m.costPerResult || 0,
      linkClicks: clicks,
      videoViews: videoViews,
      conversations: conversations,
      frequency: m.frequency || 0,
    };

    // Track whether the campaign has ANY meaningful activity
    const hasAnyResults = clicks > 0 || leads > 0 || purchases > 0 || landingPageViews > 0 || videoViews > 0 || conversations > 0;

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

      // Budget burning with truly no results (no clicks, no leads, no purchases, nothing)
      if (spend > 50 && !hasAnyResults && hasEnoughData) {
        recommendations.push({
          id: `no-results-${workspaceId}`,
          type: 'budget_decrease',
          title: 'Spending with zero results — pause and investigate',
          description: `You've spent $${spend.toFixed(2)} with no clicks, leads, or conversions recorded. This usually means pixel tracking isn't firing correctly, or there's a technical issue. Check your pixel events before spending more.`,
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

    // ============================================================
    // PROMOTE-TO-SCALING RECOMMENDATIONS (Layer 1 of #4)
    //
    // Detects the Testing + Scaling ad-set structure by ad-set name
    // ('Testing' / 'Scaling' case-insensitive). If a campaign has at least
    // one of each, we look for winners in the Testing set — ads that meet
    // ALL FOUR signals the user specified:
    //
    //   1) Hitting the user's primary KPI goal (ad-level CPR)
    //   2) CTR ≥ 1.2x the campaign average (statistically above mean)
    //   3) Reach ≥ 1000 AND age ≥ 3 days (meaningful sample size)
    //   4) Frequency < 4 (not already saturated in Testing)
    //
    // The resulting rec surfaces as "Promote to Scaling" on the card; on
    // approval, the promote-ad-to-scaling edge function duplicates the ad
    // into the Scaling set and pauses the original in Testing.
    // ============================================================

    const metaToken = (workspace?.brands as any)?.meta_access_token;

    if (adList.length > 0 && hasEnoughData && metaToken) {
      try {
        // Pull name, status, created_time, and parent ad-set details for each
        // ad we have metrics for. One call per ad — fine for the ≤50 ads a
        // typical campaign has; can batch with fields expansion later if
        // this becomes a hotspot.
        const adDetails: any[] = [];
        for (const ad of adList) {
          const adId = ad.adId || ad.id;
          if (!adId) continue;
          try {
            const res = await fetch(
              `https://graph.facebook.com/v21.0/${adId}?fields=name,status,created_time,adset{id,name,status}&access_token=${encodeURIComponent(metaToken)}`,
            );
            const data = await res.json();
            if (data && !data.error) adDetails.push({ ...ad, ...data, adId });
          } catch (e) {
            console.error(`promote-detection: failed to fetch ad ${adId}:`, e);
          }
        }

        // Classify ad sets by name. Use the first match of each — most users
        // have one Testing and one Scaling set; we refine later if needed.
        const testingSetId = adDetails.find(a => {
          const n = (a.adset?.name || '').toLowerCase();
          return n.includes('testing') || n.includes('test ') || n.endsWith(' test');
        })?.adset?.id;
        const scalingSetId = adDetails.find(a => {
          const n = (a.adset?.name || '').toLowerCase();
          return n.includes('scaling') || n.includes('scale ') || n.endsWith(' scale');
        })?.adset?.id;

        if (testingSetId && scalingSetId && testingSetId !== scalingSetId) {
          // Signal thresholds — conservative by design. Ashley explicitly
          // picked all four, so we AND them rather than scoring.
          const CTR_LIFT = 1.2;
          const MIN_REACH = 1000;
          const MIN_AGE_DAYS = 3;
          const MAX_FREQ = 4;

          // Helper to resolve an ad's primary-KPI value from its raw Meta
          // insights payload (cost_per_action_type for conversion KPIs,
          // direct field for CTR/CPC/CPM, purchase_roas array for ROAS).
          const adPrimaryValue = (ad: any): number | null => {
            if (primaryKpi === 'cpl') {
              const a = (ad.cost_per_action_type || []).find((x: any) => x.action_type === 'lead');
              return a ? parseFloat(a.value) || null : null;
            }
            if (primaryKpi === 'cpp') {
              const a = (ad.cost_per_action_type || []).find((x: any) => x.action_type === 'purchase');
              return a ? parseFloat(a.value) || null : null;
            }
            if (primaryKpi === 'cpc') return parseFloat(ad.cpc) || null;
            if (primaryKpi === 'cpm') return parseFloat(ad.cpm) || null;
            if (primaryKpi === 'ctr') return parseFloat(ad.ctr) || null;
            if (primaryKpi === 'roas') {
              const r = ad.purchase_roas;
              if (Array.isArray(r) && r.length) return parseFloat(r[0].value) || null;
              return null;
            }
            return null;
          };

          for (const ad of adDetails) {
            if (ad.adset?.id !== testingSetId) continue;
            if ((ad.status || '').toUpperCase() !== 'ACTIVE') continue;

            const adReach = parseFloat(ad.reach) || 0;
            const adCtr = parseFloat(ad.ctr) || 0;
            const adFreq = parseFloat(ad.frequency) || 0;
            const adAgeDays = ad.created_time
              ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            const adPrimary = adPrimaryValue(ad);

            // Signal 1: Hitting the user's primary KPI goal. Skip this check
            // (and the whole rec) if no goal is set — without a goal we
            // don't know what "winner" means.
            if (primaryThreshold === null || adPrimary === null) continue;
            const hittingGoal = primaryGoalType === 'less_than'
              ? adPrimary <= primaryThreshold
              : adPrimary >= primaryThreshold;

            // Signal 2: CTR meaningfully above campaign average.
            const goodCtr = ctr > 0 && adCtr >= ctr * CTR_LIFT;

            // Signal 3: statistically meaningful.
            const statsReady = adReach >= MIN_REACH && adAgeDays >= MIN_AGE_DAYS;

            // Signal 4: frequency healthy.
            const freqHealthy = adFreq < MAX_FREQ;

            if (hittingGoal && goodCtr && statsReady && freqHealthy) {
              const ctrLiftPct = ctr > 0 ? Math.round(((adCtr / ctr) - 1) * 100) : 0;
              recommendations.push({
                id: `promote-${ad.adId}`,
                type: 'promote_to_scaling',
                title: `Promote "${ad.name}" to Scaling`,
                description: `This ad hit your ${primaryKpi.toUpperCase()} goal (${formatKpiValue(primaryKpi, adPrimary)} vs ${formatThreshold(primaryKpi, primaryThreshold)}) with ${adCtr.toFixed(2)}% CTR — ${ctrLiftPct}% above your campaign average. ${adAgeDays} days of data, frequency ${adFreq.toFixed(1)}. Move it to Scaling to put more budget behind a proven winner.`,
                impact: 'Scale a proven creative into your higher-budget ad set',
                confidence: 'high',
                requiresDoubleApproval: false,
                actionPayload: {
                  workspaceId,
                  brandId,
                  sourceAdId: ad.adId,
                  sourceAdName: ad.name,
                  targetAdSetId: scalingSetId,
                  reason: 'Meets Testing→Scaling promotion criteria',
                },
                priority: priority++,
              });
            }
          }
        }
      } catch (err) {
        // Non-fatal — if the promote detection path fails we still return
        // whatever recs we've already built.
        console.error('promote-to-scaling detection failed:', err);
      }
    }

    // ============================================================
    // Apply change-awareness (#6) — happens after all rules have
    // emitted, so we filter/enrich the final set in one pass rather
    // than threading the logic through every rule.
    // ============================================================
    let finalRecs: Recommendation[] = [...recommendations];

    if (isMeaningfullyImproving) {
      // Prepend an info-only "hold for data" rec and suppress
      // contradictory aggressive recs. Pause + budget_decrease would
      // be the main offenders — pausing an ad or cutting spend on a
      // campaign that's already self-correcting is exactly what
      // Ashley flagged as the stale-advice problem today.
      finalRecs.unshift({
        id: `hold-for-data-${workspaceId}`,
        type: 'hold_for_data',
        title: 'Let recent changes breathe',
        description: (contextSummary || 'Your changes are taking effect.') +
          ' Give it 2–3 more days before making further changes — performance is still settling.',
        impact: "Don't disrupt a campaign that's already self-correcting",
        confidence: 'high',
        requiresDoubleApproval: false,
        actionPayload: {},
        priority: -1, // pin to top
        userAction: true,
        isInfoOnly: true,
      });

      const AGGRESSIVE_SUPPRESSED = new Set<Recommendation['type']>([
        'pause_ad',
        'budget_decrease',
      ]);
      finalRecs = finalRecs.filter(
        r => r.type === 'hold_for_data' || !AGGRESSIVE_SUPPRESSED.has(r.type),
      );
    }

    // Even when we're NOT suppressing, enrich every non-info rec with
    // change context so users see both the action AND the story.
    if (contextSummary) {
      finalRecs = finalRecs.map(r =>
        r.type === 'hold_for_data' || r.isInfoOnly
          ? r
          : { ...r, description: `${r.description}\n\nContext: ${contextSummary}` },
      );
    }

    // Sort: hold_for_data pinned first (via priority=-1), then high
    // confidence first, then by priority number.
    const confOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    finalRecs.sort((a, b) => {
      const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
      if (confDiff !== 0) return confDiff;
      return a.priority - b.priority;
    });

    // ============================================================
    // CARD DISPLAY (#7 Phase 2)
    //
    // Mirrors what the Ad Performance card shows in-app — primary KPI tile
    // with goal-aware status, secondary KPI tile if goals set one, plus CTR
    // and Frequency supporting tiles. The email template uses this to build
    // a report that matches the in-app view so users don't need to log in
    // just to see the same KPIs. Agreed scope with Ashley 2026-04-23.
    // ============================================================
    const tileStatus = (
      value: number | null,
      threshold: number | null,
      goalType: string,
      kpi: string,
    ): 'healthy' | 'attention' | 'critical' | 'no-data' => {
      if (value === null || value === undefined || isNaN(value)) return 'no-data';
      if (value === 0 && ['cpl', 'cpp', 'roas', 'costPerThruPlay'].includes(kpi)) return 'no-data';
      if (threshold === null || threshold === undefined) return 'no-data';
      const higherIsBetter = goalType === 'greater_than';
      if (higherIsBetter) {
        if (value >= threshold) return 'healthy';
        if (value >= threshold * 0.7) return 'attention';
        return 'critical';
      }
      if (value <= threshold) return 'healthy';
      if (value <= threshold * 1.3) return 'attention';
      return 'critical';
    };

    const cardDisplay = {
      primary: {
        key: primaryKpi,
        label: goals?.primary_kpi_label || primaryKpi.toUpperCase(),
        valueDisplay: formatKpiValue(primaryKpi, primaryValue),
        goalDisplay: primaryThreshold !== null ? formatThreshold(primaryKpi, primaryThreshold) : null,
        status: tileStatus(primaryValue, primaryThreshold, primaryGoalType, primaryKpi),
      },
      secondary: (secondaryKpi && secondaryThreshold !== null)
        ? {
            key: secondaryKpi,
            label: goals?.secondary_kpi_label || secondaryKpi.toUpperCase(),
            valueDisplay: secondaryValue !== null ? formatKpiValue(secondaryKpi, secondaryValue) : '—',
            goalDisplay: formatThreshold(secondaryKpi, secondaryThreshold),
            status: tileStatus(secondaryValue, secondaryThreshold, secondaryGoalType, secondaryKpi),
          }
        : null,
      ctr: {
        valueDisplay: ctr > 0 ? `${ctr.toFixed(2)}%` : '—',
        benchmarkDisplay: '1.0%+',
        status: (ctr === 0
          ? 'no-data'
          : ctr >= 1.0
            ? 'healthy'
            : ctr >= 0.7
              ? 'attention'
              : 'critical') as 'healthy' | 'attention' | 'critical' | 'no-data',
      },
      frequency: {
        valueDisplay: frequency > 0 ? frequency.toFixed(1) : '—',
        goalDisplay: `< ${frequencyThreshold}`,
        status: (frequency === 0
          ? 'no-data'
          : frequency <= frequencyThreshold
            ? 'healthy'
            : frequency <= frequencyThreshold * 1.25
              ? 'attention'
              : 'critical') as 'healthy' | 'attention' | 'critical' | 'no-data',
      },
      // Overall status drives the action-rec badge color in the email.
      overallStatus: (() => {
        if (primaryThreshold === null) {
          if (!hasAnyResults && spend < 1) return 'no-data' as const;
          return 'healthy' as const;
        }
        if (primaryMet === true && !frequencyHigh) return 'healthy' as const;
        if (primaryMet === true && frequencyHigh) return 'attention' as const;
        if (primaryClose === true) return 'attention' as const;
        return 'critical' as const;
      })(),
      // Mirrors InsightsHome.getActionRecommendation() copy so users see
      // the same verdict word in both surfaces.
      actionRec: (() => {
        if (primaryThreshold === null) {
          if (spend > 50 || reach >= 1000) return 'Try new angles';
          return 'Wait for more data';
        }
        if (primaryMet === true && !frequencyHigh) return 'Increase budget';
        if (primaryMet === true && frequencyHigh) return 'Refresh creative before scaling';
        if (primaryClose === true) return 'Keep spend the same';
        return 'Refresh creative or pause';
      })(),
      spendDisplay: spend > 0 ? `$${spend.toFixed(2)}` : '$0.00',
    };

    return new Response(
      JSON.stringify({ success: true, recommendations: finalRecs, changeContext, cardDisplay }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('generate-recommendations error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
