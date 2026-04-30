import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// generate-campaign-retrospective (Patch #24 rework)
//
// Major changes vs patch #23:
//   1. Reads `campaign_goals` for the workspace and surfaces the goal
//      (KPI + threshold + direction) as the central anchor of the retro.
//   2. Uses Meta's actual campaign date_start / date_stop for duration
//      instead of workspace.created_at — fixes the imported-campaign bug
//      where duration was always "1 day."
//   3. Accepts an optional `dateRange: { start, end }` to scope the retro
//      to a custom window instead of always pulling lifetime.
//   4. Adds explicit realism-check guidance to the prompt — tells the AI
//      when to flag insufficient data instead of inventing wins/misses.
//   5. Returns `goal_context` and `data_quality` fields in the response so
//      the UI can render goal-vs-actual + warning banners.
//
// Inputs (one of):
//   { workspaceId, dateRange? }
//   { brandId, metaCampaignId, dateRange?, goalOverride? }
//
// goalOverride: { primary_kpi, primary_kpi_label, primary_kpi_threshold,
//                 primary_kpi_goal_type } — optional, used when the user
//                 sets a goal in the pre-flight dialog without persisting.
// ============================================================================

interface RetrospectiveJSON {
  summary: string;
  stats: {
    total_spend: number;
    total_results: number;
    avg_cpl: number | null;
    duration_days: number | null;
    objective: string | null;
    goal_label?: string | null;
    goal_threshold?: number | null;
    goal_unit?: string | null;
    goal_direction?: 'less_than' | 'greater_than' | null;
    goal_actual?: number | null;
    goal_hit?: boolean | null;
    goal_delta_pct?: number | null;
  };
  data_quality: 'high' | 'medium' | 'low' | 'insufficient';
  data_quality_note?: string;
  wins: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  misses: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  recommendations: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  generated_at: string;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // -- 1. Resolve to a workspace (creating a stub if needed for imported campaigns).
    let workspaceId: string | null = body?.workspaceId ?? null;

    if (!workspaceId && body?.metaCampaignId && body?.brandId) {
      const { data: ownerCheck } = await sb
        .from('brands').select('id, user_id').eq('id', body.brandId).single();
      if (!ownerCheck || ownerCheck.user_id !== user.id) {
        return json({ error: 'Forbidden' }, 403);
      }
      const { data: existingWs } = await sb
        .from('campaign_workspaces').select('id, meta_campaign_ids').eq('brand_id', body.brandId);
      const found = (existingWs || []).find(
        (w: any) => w?.meta_campaign_ids?.campaignId === body.metaCampaignId,
      );
      if (found) {
        workspaceId = found.id;
      } else {
        let metaName = 'Imported campaign';
        try {
          const { data: brand } = await sb
            .from('brands').select('meta_access_token').eq('id', body.brandId).single();
          if (brand?.meta_access_token) {
            const r = await fetch(
              `https://graph.facebook.com/v21.0/${body.metaCampaignId}?fields=name,objective&access_token=${brand.meta_access_token}`,
            );
            const d = await r.json();
            if (r.ok && d?.name) metaName = d.name;
          }
        } catch (_) { /* non-fatal */ }
        const { data: created, error: createErr } = await sb
          .from('campaign_workspaces').insert({
            brand_id: body.brandId,
            name: metaName,
            offer_name: metaName,
            meta_campaign_ids: { campaignId: body.metaCampaignId },
            archived: true,
            archived_at: new Date().toISOString(),
          })
          .select('id').single();
        if (createErr || !created) {
          console.error('Stub workspace creation failed:', createErr);
          return json({ error: 'Could not create workspace stub for this campaign' }, 500);
        }
        workspaceId = created.id;
      }
    }

    if (!workspaceId) {
      return json({ error: 'Either workspaceId or (brandId + metaCampaignId) is required' }, 400);
    }

    // -- 2. Workspace + brand + ownership check.
    const { data: workspace, error: wErr } = await sb
      .from('campaign_workspaces')
      .select('id, brand_id, name, offer_name, creative_json, production_items, strategy_json, archived_at, created_at, meta_campaign_ids')
      .eq('id', workspaceId)
      .single();
    if (wErr || !workspace) return json({ error: 'Workspace not found' }, 404);

    const { data: brand, error: bErr } = await sb
      .from('brands')
      .select('id, user_id, name, meta_account_id, meta_access_token')
      .eq('id', workspace.brand_id)
      .single();
    if (bErr || !brand) return json({ error: 'Brand not found' }, 404);
    if (brand.user_id !== user.id) return json({ error: 'Forbidden' }, 403);

    const metaCampaignId = (workspace.meta_campaign_ids as any)?.campaignId || null;

    // -- 3. Goal: priority is goalOverride > stored campaign_goals row > none.
    let goal: GoalContext | null = null;
    if (body?.goalOverride && body.goalOverride.primary_kpi && body.goalOverride.primary_kpi_threshold != null) {
      goal = {
        kpi: String(body.goalOverride.primary_kpi),
        label: String(body.goalOverride.primary_kpi_label || body.goalOverride.primary_kpi),
        threshold: Number(body.goalOverride.primary_kpi_threshold),
        direction: body.goalOverride.primary_kpi_goal_type === 'greater_than' ? 'greater_than' : 'less_than',
        unit: inferUnitFromKpi(String(body.goalOverride.primary_kpi)),
        source: 'override',
      };
    } else {
      const { data: goalRow } = await sb
        .from('campaign_goals')
        .select('primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (goalRow && goalRow.primary_kpi && goalRow.primary_kpi_threshold != null) {
        goal = {
          kpi: String(goalRow.primary_kpi),
          label: String(goalRow.primary_kpi_label || goalRow.primary_kpi),
          threshold: Number(goalRow.primary_kpi_threshold),
          direction: goalRow.primary_kpi_goal_type === 'greater_than' ? 'greater_than' : 'less_than',
          unit: inferUnitFromKpi(String(goalRow.primary_kpi)),
          source: 'stored',
        };
      }
    }

    // -- 4. Pull Meta performance over the requested date range (or lifetime).
    const dateRange = body?.dateRange && body.dateRange.start && body.dateRange.end
      ? { start: String(body.dateRange.start), end: String(body.dateRange.end) }
      : null;

    const performance = metaCampaignId && brand.meta_access_token
      ? await fetchCampaignPerformance(metaCampaignId, brand.meta_access_token, dateRange)
      : null;

    // -- 5. Compute duration honestly. Prefer Meta's actual date_start/date_stop
    //       (returned in performance.totals) → falls back to dateRange → falls
    //       back to workspace timestamps as a last resort.
    const durationDays = computeDurationDays(performance, dateRange, workspace);

    // -- 6. Compute goal-vs-actual + data quality flag.
    const actualValue = goal ? extractGoalActualValue(goal.kpi, performance?.totals) : null;
    const goalEval = goal && actualValue != null ? evalGoal(goal, actualValue) : null;
    const dq = assessDataQuality({
      totalSpend: performance?.totals?.spend ?? 0,
      totalResults: performance?.totals?.results ?? 0,
      durationDays,
      goal,
    });

    // -- 7. Build prompt + call AI.
    const prompt = buildPrompt({
      brandName: brand.name,
      offerName: workspace.offer_name || workspace.name || 'Unnamed campaign',
      durationDays,
      dateRange,
      goal,
      goalEval,
      dataQuality: dq,
      strategy: workspace.strategy_json,
      creative: workspace.creative_json,
      productionItems: workspace.production_items,
      performance,
      isImported: !workspace.creative_json,
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return json({ error: 'LOVABLE_API_KEY not configured' }, 500);
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert Meta ads strategist running a post-mortem on a completed campaign. Be specific, honest, and grounded in the data. If the data is too thin to draw conclusions, say so explicitly — never invent wins, misses, or recommendations to fill the report. Return ONLY valid JSON matching the schema in the user prompt — no prose, no code fences.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '');
      console.error('AI gateway error:', aiRes.status, errText);
      return json({ error: `AI analysis failed (${aiRes.status})` }, 502);
    }
    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content ?? '';
    const cleaned = String(raw)
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: any;
    try { parsed = JSON.parse(cleaned); }
    catch (_) {
      console.error('Parse failed. Raw:', cleaned.slice(0, 400));
      return json({ error: 'AI returned unparseable output. Try again.' }, 502);
    }

    const retrospective: RetrospectiveJSON = {
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 600) : '',
      stats: {
        total_spend: numberOr(parsed?.stats?.total_spend, performance?.totals?.spend ?? 0),
        total_results: Math.round(numberOr(parsed?.stats?.total_results, performance?.totals?.results ?? 0)),
        avg_cpl: parsed?.stats?.avg_cpl != null ? numberOr(parsed.stats.avg_cpl, null) : performance?.totals?.cpl ?? null,
        duration_days: durationDays,
        objective: workspace.strategy_json?.objective || performance?.totals?.objective || null,
        goal_label: goal?.label ?? null,
        goal_threshold: goal?.threshold ?? null,
        goal_unit: goal?.unit ?? null,
        goal_direction: goal?.direction ?? null,
        goal_actual: actualValue,
        goal_hit: goalEval?.hit ?? null,
        goal_delta_pct: goalEval?.deltaPct ?? null,
      },
      data_quality: dq.level,
      data_quality_note: dq.note,
      wins: normalizeBullets(parsed.wins),
      misses: normalizeBullets(parsed.misses),
      recommendations: normalizeBullets(parsed.recommendations),
      generated_at: new Date().toISOString(),
    };

    // -- 8. Persist + extract learnings (skip if data quality is insufficient
    //       so we don't pollute brand_learnings with nothing-confident).
    await sb.from('campaign_workspaces').update({
      retrospective_json: retrospective,
      retrospective_generated_at: retrospective.generated_at,
    }).eq('id', workspaceId);

    await sb.from('brand_learnings').update({ is_active: false })
      .eq('source_workspace_id', workspaceId);

    if (retrospective.data_quality !== 'insufficient') {
      const rows: any[] = [];
      const pushAll = (arr: typeof retrospective.wins, category: 'win' | 'miss' | 'recommendation') => {
        arr.forEach(b => {
          rows.push({
            brand_id: brand.id,
            source_workspace_id: workspaceId,
            category,
            insight: b.insight,
            supporting_data: b.supporting_data || null,
            confidence: b.confidence,
            is_active: true,
          });
        });
      };
      pushAll(retrospective.wins, 'win');
      pushAll(retrospective.misses, 'miss');
      pushAll(retrospective.recommendations, 'recommendation');
      if (rows.length > 0) {
        const { error: insErr } = await sb.from('brand_learnings').insert(rows);
        if (insErr) console.error('brand_learnings insert failed (non-fatal):', insErr);
      }
    }

    return json({ success: true, retrospective, workspaceId });
  } catch (err: any) {
    console.error('generate-campaign-retrospective error:', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function numberOr(v: any, fallback: any): any {
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  return n;
}

function normalizeBullets(arr: any): RetrospectiveJSON['wins'] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 8).map(item => ({
    insight: typeof item?.insight === 'string' ? item.insight.slice(0, 400) : '',
    supporting_data: typeof item?.supporting_data === 'string' ? item.supporting_data.slice(0, 400) : undefined,
    confidence: item?.confidence === 'high' || item?.confidence === 'low' ? item.confidence : 'medium',
  })).filter(x => x.insight.length > 0);
}

// ---------------------------------------------------------------------------
// Goal handling
// ---------------------------------------------------------------------------

interface GoalContext {
  kpi: string;
  label: string;
  threshold: number;
  direction: 'less_than' | 'greater_than';
  unit: '$' | 'x' | '%' | '';
  source: 'stored' | 'override';
}

function inferUnitFromKpi(kpi: string): '$' | 'x' | '%' | '' {
  const k = kpi.toLowerCase();
  if (k === 'roas') return 'x';
  if (k === 'ctr' || k === 'cvr' || k === 'conversion_rate') return '%';
  if (k.startsWith('cp') || k.includes('cost')) return '$';
  return '';
}

function extractGoalActualValue(kpi: string, totals: any): number | null {
  if (!totals) return null;
  const k = kpi.toLowerCase();
  if (k === 'cpl' || k === 'cpa' || k === 'cost_per_result') return totals.cpl ?? null;
  if (k === 'cpc') return totals.cpc ?? null;
  if (k === 'cpm') return totals.cpm ?? null;
  if (k === 'ctr') return totals.ctr ?? null;
  if (k === 'roas') return totals.roas ?? null;
  return totals.cpl ?? null; // sensible default
}

function evalGoal(goal: GoalContext, actual: number): { hit: boolean; deltaPct: number } {
  const hit = goal.direction === 'less_than' ? actual <= goal.threshold : actual >= goal.threshold;
  const deltaPct = goal.threshold === 0 ? 0 : ((actual - goal.threshold) / goal.threshold) * 100;
  return { hit, deltaPct: Math.round(deltaPct * 10) / 10 };
}

// ---------------------------------------------------------------------------
// Data quality assessment
// ---------------------------------------------------------------------------

function assessDataQuality(args: {
  totalSpend: number; totalResults: number; durationDays: number | null; goal: GoalContext | null;
}): { level: RetrospectiveJSON['data_quality']; note?: string } {
  const reasons: string[] = [];
  if (args.totalSpend < 50) reasons.push(`Total spend was only $${args.totalSpend.toFixed(2)}`);
  if (args.totalResults < 30) reasons.push(`Only ${Math.round(args.totalResults)} results recorded (threshold for stat-sig comparison is ~30)`);
  if (args.durationDays != null && args.durationDays < 7) reasons.push(`Campaign ran for only ${args.durationDays} day${args.durationDays === 1 ? '' : 's'} — Meta's algorithm typically needs 7+ days to optimize`);

  if (args.goal && args.totalSpend > 0) {
    // For CPL-style goals, a useful sanity check: were we spending enough to
    // theoretically hit the goal at the requested volume?
    if (args.goal.unit === '$' && args.goal.threshold > 0) {
      const expectedConversions = args.totalSpend / args.goal.threshold;
      if (expectedConversions < 10) {
        reasons.push(`At your $${args.goal.threshold.toFixed(2)} ${args.goal.label} target, the spend-to-date supports at most ${Math.floor(expectedConversions)} conversions — too few to evaluate the goal honestly`);
      }
    }
  }

  if (reasons.length === 0) return { level: 'high' };
  if (reasons.length === 1) return { level: 'medium', note: reasons[0] };
  if (args.totalResults < 10 || args.totalSpend < 25) {
    return { level: 'insufficient', note: reasons.join('. ') + '.' };
  }
  return { level: 'low', note: reasons.join('. ') + '.' };
}

// ---------------------------------------------------------------------------
// Duration math
// ---------------------------------------------------------------------------

function computeDurationDays(
  performance: any,
  dateRange: { start: string; end: string } | null,
  workspace: any,
): number | null {
  // Meta's insights response includes date_start / date_stop on each row.
  const t = performance?.totals;
  if (t?.date_start && t?.date_stop) {
    const a = new Date(t.date_start).getTime();
    const b = new Date(t.date_stop).getTime();
    if (isFinite(a) && isFinite(b) && b >= a) {
      return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
    }
  }
  if (dateRange) {
    const a = new Date(dateRange.start).getTime();
    const b = new Date(dateRange.end).getTime();
    if (isFinite(a) && isFinite(b) && b >= a) {
      return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
    }
  }
  if (workspace?.created_at) {
    const startedAt = new Date(workspace.created_at);
    const endedAt = workspace?.archived_at ? new Date(workspace.archived_at) : new Date();
    return Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Meta API helper
// ---------------------------------------------------------------------------

async function fetchCampaignPerformance(
  metaCampaignId: string,
  accessToken: string,
  dateRange: { start: string; end: string } | null,
) {
  const fields = [
    'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks',
    'ctr', 'cpc', 'cpm', 'actions', 'cost_per_action_type',
    'objective', 'date_start', 'date_stop',
  ].join(',');

  const timeParam = dateRange
    ? `time_range=${encodeURIComponent(JSON.stringify({ since: dateRange.start, until: dateRange.end }))}`
    : `date_preset=lifetime`;

  try {
    const campaignRes = await fetch(
      `https://graph.facebook.com/v21.0/${metaCampaignId}/insights?fields=${fields}&${timeParam}&level=campaign&access_token=${accessToken}`,
    );
    const campaignData = await campaignRes.json();
    const adsetRes = await fetch(
      `https://graph.facebook.com/v21.0/${metaCampaignId}/insights?fields=${fields},adset_id,adset_name&${timeParam}&level=adset&access_token=${accessToken}`,
    );
    const adsetData = await adsetRes.json();
    const adRes = await fetch(
      `https://graph.facebook.com/v21.0/${metaCampaignId}/insights?fields=${fields},ad_id,ad_name,adset_id&${timeParam}&level=ad&access_token=${accessToken}`,
    );
    const adData = await adRes.json();

    const c = campaignData?.data?.[0];
    const totals = c
      ? {
          spend: Number(c.spend || 0),
          impressions: Number(c.impressions || 0),
          clicks: Number(c.clicks || 0),
          ctr: Number(c.ctr || 0),
          cpc: Number(c.cpc || 0),
          cpm: Number(c.cpm || 0),
          results: extractResultCount(c),
          cpl: extractCostPerResult(c),
          objective: c.objective,
          date_start: c.date_start,
          date_stop: c.date_stop,
        }
      : null;

    return { totals, adsets: adsetData?.data || [], ads: adData?.data || [] };
  } catch (err) {
    console.error('Meta API fetch failed:', err);
    return null;
  }
}

function extractResultCount(insight: any): number {
  const actions = insight?.actions;
  if (!Array.isArray(actions)) return 0;
  const priority = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'offsite_conversion.fb_pixel_lead', 'complete_registration'];
  for (const t of priority) {
    const m = actions.find((a: any) => a.action_type === t);
    if (m) return Number(m.value || 0);
  }
  return 0; // Don't fall back to clicks — that conflated metrics in patch #20.
}

function extractCostPerResult(insight: any): number | null {
  const cpa = insight?.cost_per_action_type;
  if (!Array.isArray(cpa)) return null;
  const priority = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'offsite_conversion.fb_pixel_lead'];
  for (const t of priority) {
    const m = cpa.find((a: any) => a.action_type === t);
    if (m && m.value) return Number(m.value);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(args: {
  brandName: string;
  offerName: string;
  durationDays: number | null;
  dateRange: { start: string; end: string } | null;
  goal: GoalContext | null;
  goalEval: { hit: boolean; deltaPct: number } | null;
  dataQuality: { level: string; note?: string };
  strategy: any;
  creative: any;
  productionItems: any;
  performance: any;
  isImported: boolean;
}): string {
  const goalLine = args.goal
    ? `User's stated goal: ${args.goal.label} ${args.goal.direction === 'less_than' ? '≤' : '≥'} ${formatGoalValue(args.goal)}.${
        args.goalEval
          ? ` Actual: ${formatActualValue(args.goal, args.performance?.totals)} (${args.goalEval.hit ? 'HIT' : 'MISSED'} by ${Math.abs(args.goalEval.deltaPct).toFixed(1)}%).`
          : ' (No actual computed — check spend / data quality.)'
      }`
    : "User did NOT set an explicit goal for this campaign. Use industry benchmarks for context but don't manufacture a 'pass/fail' framing.";

  const summary = {
    brand: args.brandName,
    offer: args.offerName,
    duration_days: args.durationDays,
    date_range: args.dateRange,
    note: args.isImported
      ? 'This campaign was imported from Meta — LUMI does not have its angle/copy metadata. Base your post-mortem on the Meta performance data + ad/adset name patterns.'
      : null,
    strategy_objective: args.strategy?.objective || args.performance?.totals?.objective || 'unknown',
    strategy_audiences: args.strategy?.audiences || args.strategy?.audience_set || null,
    angles: Array.isArray(args.creative?.angles)
      ? args.creative.angles.map((a: any) => ({
          name: a.name || a.angle_name,
          hook: a.hook || a.opening,
          format: a.format,
        }))
      : [],
    production_count: Array.isArray(args.productionItems) ? args.productionItems.length : 0,
    performance_totals: args.performance?.totals || null,
    adset_breakdown: (args.performance?.adsets || []).slice(0, 10).map((a: any) => ({
      name: a.adset_name, spend: Number(a.spend || 0),
      results: extractResultCount(a), cpl: extractCostPerResult(a),
    })),
    ad_breakdown: (args.performance?.ads || []).slice(0, 20).map((a: any) => ({
      name: a.ad_name, adset: a.adset_id, spend: Number(a.spend || 0),
      results: extractResultCount(a), cpl: extractCostPerResult(a), ctr: Number(a.ctr || 0),
    })),
  };

  return `Run a post-mortem on this Meta ads campaign. Be specific, honest, and ground every claim in the data.

${goalLine}

Pre-computed data quality assessment: ${args.dataQuality.level.toUpperCase()}${args.dataQuality.note ? ` — ${args.dataQuality.note}` : ''}

Campaign data:
${JSON.stringify(summary, null, 2)}

Return a JSON object with this exact shape (no prose, no code fences):

{
  "summary": "One or two sentences — the headline takeaway, framed against the goal if there is one.",
  "stats": {
    "total_spend": number,
    "total_results": number,
    "avg_cpl": number or null,
    "duration_days": number or null,
    "objective": string or null
  },
  "wins": [
    { "insight": "string", "supporting_data": "string with concrete numbers", "confidence": "high" | "medium" | "low" }
  ],
  "misses": [
    { "insight": "string", "supporting_data": "string with concrete numbers", "confidence": "..." }
  ],
  "recommendations": [
    { "insight": "string — actionable for next campaign", "supporting_data": "string explaining why", "confidence": "..." }
  ]
}

CRITICAL GUIDANCE:

1. **HONOR THE DATA QUALITY FLAG.** If the pre-computed data quality is "insufficient":
   - Set wins, misses, and recommendations arrays to EMPTY or near-empty.
   - Use the summary to explain WHAT the user would need (more spend, more time, more conversions) before a confident post-mortem is possible.
   - Do NOT manufacture insights from thin data. Pretending to know is worse than admitting we don't.

2. **GOAL-CENTRIC FRAMING.** If a goal is stated:
   - The first win or miss should explicitly address whether the goal was hit, by how much, and at what confidence.
   - Recommendations should orient toward closing the gap (or scaling the win).

3. **REALISM.** If the user's goal was unreachable given the spend/duration (e.g. they wanted 100 leads at $5 but only spent $200), call this out as a "miss" framed as goal-setting feedback, not a campaign failure.

4. **VOLUME.** Aim for 2-3 wins, 2-3 misses, 4-5 recommendations when data supports it. Fewer when it doesn't. Never fill quotas with weak insights.

5. **CITE THE NUMBERS.** Reference specific ad names, adset names, spend numbers, CPLs. Generic advice is worthless.

6. **CONFIDENCE.** Use "high" only when the data clearly supports the claim. "Medium" is the default. "Low" when the dataset is thin but the pattern is suggestive.

Return ONLY the JSON object.`;
}

function formatGoalValue(goal: GoalContext): string {
  if (goal.unit === '$') return `$${goal.threshold.toFixed(2)}`;
  if (goal.unit === 'x') return `${goal.threshold.toFixed(2)}x`;
  if (goal.unit === '%') return `${goal.threshold.toFixed(2)}%`;
  return String(goal.threshold);
}

function formatActualValue(goal: GoalContext, totals: any): string {
  const v = extractGoalActualValue(goal.kpi, totals);
  if (v == null) return 'unknown';
  return formatGoalValue({ ...goal, threshold: v });
}
