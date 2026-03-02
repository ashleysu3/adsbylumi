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
    const { workspaceId, brandId, metrics, ads, benchItems } = await req.json();

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Missing workspaceId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get workspace data
    const { data: workspace } = await supabase
      .from('campaign_workspaces')
      .select('*, brands(name, alert_thresholds, notification_preferences)')
      .eq('id', workspaceId)
      .single();

    const alertThresholds = (workspace?.brands as any)?.alert_thresholds || {
      ctr_warning: 0.8,
      frequency_warning: 4,
    };
    const creativeAutomation = (workspace?.brands as any)?.notification_preferences?.creative_automation || {};
    const fatigueThreshold = creativeAutomation.fatigue_threshold || alertThresholds.frequency_warning || 4;

    const recommendations: Recommendation[] = [];
    let priority = 0;

    const campaignMetrics = metrics || {};
    const adList: any[] = ads || [];
    const bench: any[] = benchItems || [];

    // 1. Budget recommendations based on overall campaign metrics
    if (campaignMetrics.roas !== undefined && campaignMetrics.roas !== null) {
      if (campaignMetrics.roas >= 4) {
        recommendations.push({
          id: `budget-scale-${workspaceId}`,
          type: 'budget_increase',
          title: 'Scale budget +20%',
          description: `ROAS of ${Number(campaignMetrics.roas).toFixed(1)}x is exceptional. Increase daily budget to capture more conversions at this efficiency.`,
          impact: 'Could increase conversions by ~20% at similar ROAS',
          confidence: 'high',
          requiresDoubleApproval: true,
          actionPayload: { workspaceId, percentageChange: 20, currentBudget: campaignMetrics.dailyBudget },
          priority: priority++,
        });
      } else if (campaignMetrics.roas >= 2.5) {
        recommendations.push({
          id: `budget-modest-${workspaceId}`,
          type: 'budget_increase',
          title: 'Increase budget +10%',
          description: `Solid ${Number(campaignMetrics.roas).toFixed(1)}x ROAS. A modest budget increase could drive more results without overspending.`,
          impact: 'Gradual scaling while maintaining efficiency',
          confidence: 'medium',
          requiresDoubleApproval: true,
          actionPayload: { workspaceId, percentageChange: 10, currentBudget: campaignMetrics.dailyBudget },
          priority: priority++,
        });
      } else if (campaignMetrics.roas < 1) {
        recommendations.push({
          id: `budget-reduce-${workspaceId}`,
          type: 'budget_decrease',
          title: 'Reduce budget -30%',
          description: `ROAS of ${Number(campaignMetrics.roas).toFixed(1)}x is below breakeven. Reduce spend while we optimize.`,
          impact: 'Stop burning budget on underperforming delivery',
          confidence: 'high',
          requiresDoubleApproval: true,
          actionPayload: { workspaceId, percentageChange: -30, currentBudget: campaignMetrics.dailyBudget },
          priority: priority++,
        });
      }
    }

    // 1b. Campaign-level metric recommendations (no ROAS required)
    const ctr = campaignMetrics.ctr || (campaignMetrics.clicks && campaignMetrics.impressions ? (campaignMetrics.clicks / campaignMetrics.impressions) * 100 : null);
    const frequency = campaignMetrics.frequency || null;
    const reach = campaignMetrics.reach || 0;
    const hasEnoughData = reach >= 1000;

    if (hasEnoughData && ctr !== null && ctr < alertThresholds.ctr_warning) {
      recommendations.push({
        id: `low-ctr-${workspaceId}`,
        type: 'create_creative',
        title: 'Creative isn\'t resonating',
        description: `CTR of ${Number(ctr).toFixed(2)}% is below the ${alertThresholds.ctr_warning}% benchmark. Your audience isn't clicking — time to test new hooks or angles.`,
        impact: 'Fresh creative can dramatically improve engagement',
        confidence: reach >= 3000 ? 'high' : 'medium',
        requiresDoubleApproval: false,
        actionPayload: { workspaceId, brandId },
        userAction: true,
        actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
        priority: priority++,
      });
    }

    if (hasEnoughData && ctr !== null && ctr >= 2.0 && campaignMetrics.cpl && campaignMetrics.cpl < 10) {
      recommendations.push({
        id: `strong-perf-${workspaceId}`,
        type: 'budget_increase',
        title: 'Strong performance — scale up',
        description: `CTR of ${Number(ctr).toFixed(2)}% and CPL of $${Number(campaignMetrics.cpl).toFixed(2)} show this campaign is converting efficiently. Consider increasing budget.`,
        impact: 'Capture more leads at this strong cost per lead',
        confidence: 'high',
        requiresDoubleApproval: true,
        actionPayload: { workspaceId, percentageChange: 20, currentBudget: campaignMetrics.dailyBudget },
        priority: priority++,
      });
    }

    if (hasEnoughData && frequency !== null && frequency >= fatigueThreshold) {
      recommendations.push({
        id: `fatigue-${workspaceId}`,
        type: 'create_creative',
        title: 'Creative fatigue detected',
        description: `Frequency of ${Number(frequency).toFixed(1)} means people are seeing your ads too many times. Fresh creative will re-engage your audience.`,
        impact: 'Prevent declining performance from ad fatigue',
        confidence: 'high',
        requiresDoubleApproval: false,
        actionPayload: { workspaceId, brandId },
        userAction: true,
        actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
        priority: priority++,
      });
    }

    if (hasEnoughData && campaignMetrics.cpp && campaignMetrics.cpp > 100) {
      recommendations.push({
        id: `high-cpp-${workspaceId}`,
        type: 'create_creative',
        title: 'Cost per purchase is high',
        description: `CPP of $${Number(campaignMetrics.cpp).toFixed(2)} suggests your funnel needs attention. Test new creative angles or review your offer alignment.`,
        impact: 'Lower acquisition cost and improve profitability',
        confidence: 'medium',
        requiresDoubleApproval: false,
        actionPayload: { workspaceId, brandId },
        userAction: true,
        actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
        priority: priority++,
      });
    }

    // 2. Ad-level recommendations
    for (const ad of adList) {
      const reach = ad.reach || ad.impressions || 0;
      const age = ad.created_time
        ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / (1000 * 60 * 60 * 24))
        : 7;

      // Skip ads still in learning
      if (reach < 1000 || age < 3) continue;

      // Pause low performers
      if (ad.ctr < alertThresholds.ctr_warning && ad.status === 'ACTIVE') {
        recommendations.push({
          id: `pause-ad-${ad.id}`,
          type: 'pause_ad',
          title: `Pause "${ad.name}"`,
          description: `CTR of ${Number(ad.ctr).toFixed(2)}% is below ${alertThresholds.ctr_warning}% threshold. This ad isn't engaging your audience.`,
          impact: 'Stop wasting spend on underperforming creative',
          confidence: reach >= 2000 ? 'high' : 'medium',
          requiresDoubleApproval: false,
          actionPayload: { workspaceId, adId: ad.id, action: 'pause' },
          priority: priority++,
        });
      }

      // Resume strong paused ads
      if (ad.status === 'PAUSED' && ad.ctr >= 1.5) {
        recommendations.push({
          id: `resume-ad-${ad.id}`,
          type: 'resume_ad',
          title: `Resume "${ad.name}"`,
          description: `This ad had ${Number(ad.ctr).toFixed(2)}% CTR before being paused. It could still perform well.`,
          impact: 'Reactivate a proven performer',
          confidence: 'medium',
          requiresDoubleApproval: false,
          actionPayload: { workspaceId, adId: ad.id, action: 'unpause' },
          priority: priority++,
        });
      }

      // Fatigue detection → swap creative or prompt user to create new
      if (ad.frequency && ad.frequency >= fatigueThreshold && ad.status === 'ACTIVE') {
        const availableBench = bench.filter(b => b.auto_rotate_approved && b.meta_ad_id && b.status === 'bench');
        if (availableBench.length > 0) {
          recommendations.push({
            id: `swap-creative-${ad.id}`,
            type: 'swap_creative',
            title: `Refresh "${ad.name}" with bench creative`,
            description: `Frequency of ${Number(ad.frequency).toFixed(1)} means your audience is seeing this ad too often. Swap in fresh creative from your bench.`,
            impact: 'Combat creative fatigue and restore engagement',
            confidence: 'high',
            requiresDoubleApproval: false,
            actionPayload: {
              workspaceId,
              brandId,
              fatigueAdId: ad.id,
              benchAdId: availableBench[0].meta_ad_id,
              benchItemName: availableBench[0].production_item_id || 'Bench creative',
            },
            priority: priority++,
          });
        } else {
          // No bench creative available — user needs to create new creative
          recommendations.push({
            id: `create-creative-${ad.id}`,
            type: 'create_creative',
            title: `Create fresh creative for "${ad.name}"`,
            description: `Frequency of ${Number(ad.frequency).toFixed(1)} is causing fatigue, but your bench is empty. Time to create new creative to keep performance strong.`,
            impact: 'Prevent further performance decline from creative fatigue',
            confidence: 'high',
            requiresDoubleApproval: false,
            actionPayload: { workspaceId, brandId, fatigueAdId: ad.id },
            userAction: true,
            actionUrl: `/creative?workspace=${workspaceId}&refreshCreative=true`,
            priority: priority++,
          });
        }
      }
    }

    // Sort by priority (lower = higher priority)
    recommendations.sort((a, b) => {
      // High confidence first
      const confOrder = { high: 0, medium: 1, low: 2 };
      return confOrder[a.confidence] - confOrder[b.confidence];
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
