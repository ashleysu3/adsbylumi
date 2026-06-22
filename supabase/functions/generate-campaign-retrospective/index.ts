import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// generate-campaign-retrospective (Patch #27 — reframed + plain English)
//
// Changes vs patch #26:
//   - Section framing shifts from "wins / misses / recommendations" to
//     "what worked / what underperformed (and why) / worth testing next."
//     The point of a retrospective isn't to flag underperformers as
//     failures — every ad portfolio has a spread, and the goal is to
//     extract patterns that inform the next round.
//   - System prompt explicitly asks for plain English (no jargon, like
//     explaining to a small-business owner who runs their own ads).
//   - Adds a `narrative` field — 2-3 short paragraphs that read top-to-
//     bottom like a coach's debrief.
// ============================================================================

const LUMI_KPI_FROM_OBJECTIVE: Record<string, string> = {
  'lead-gen': 'cpl', 'Leads': 'cpl', 'LEAD_GENERATION': 'cpl', 'OUTCOME_LEADS': 'cpl',
  'Discovery Call / Application': 'cpl', 'discovery-call': 'cpl',
  'Email Capture': 'cpl', 'Lead Magnet Downloads': 'cpl',
  'webinar': 'cpl', 'Webinar Registration': 'cpl', 'Webinar Sign Ups': 'cpl',
  'low-ticket': 'cpp', 'Low Ticket Product Sales': 'cpp',
  'Sales': 'roas', 'CONVERSIONS': 'roas', 'OUTCOME_SALES': 'roas',
  'ig-traffic': 'cpc', 'Traffic': 'cpc', 'LINK_CLICKS': 'cpc', 'OUTCOME_TRAFFIC': 'cpc',
  'Traffic to Instagram/Facebook': 'cpc', 'Traffic to Instagram': 'cpc', 'Traffic to Facebook': 'cpc',
  'video-views': 'costPerThruPlay', 'VIDEO_VIEWS': 'costPerThruPlay', 'ThruPlay Video Views': 'costPerThruPlay',
  'Engagement': 'cpm', 'ENGAGEMENT': 'cpm', 'OUTCOME_ENGAGEMENT': 'cpm',
  'REACH': 'cpm', 'BRAND_AWARENESS': 'cpm', 'OUTCOME_AWARENESS': 'cpm',
};

const KPI_LABELS: Record<string, string> = {
  cpl: 'Cost Per Lead', cpp: 'Cost Per Purchase', cpc: 'Cost Per Click',
  cpm: 'Cost Per 1k Impressions', ctr: 'Click-Through Rate', roas: 'Return on Ad Spend',
  costPerThruPlay: 'Cost Per ThruPlay',
};
const KPI_UNIT: Record<string, '$' | 'x' | '%' | ''> = {
  cpl: '$', cpp: '$', cpc: '$', cpm: '$', costPerThruPlay: '$', roas: 'x', ctr: '%',
};

const LEAD_ACTION_TYPES = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'onsite_conversion.lead', 'submit_application_total'];
const PURCHASE_ACTION_TYPES = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.purchase', 'omni_purchase'];
const VIDEO_VIEW_ACTION_TYPES = ['video_view', 'video_thruplay_watched_actions'];

interface RetrospectiveJSON {
  summary: string;
  /** Plain-English 2-3 paragraph debrief. Reads top-to-bottom. */
  narrative?: string;
  stats: {
    total_spend: number;
    total_results: number;
    avg_cpl: number | null;
    duration_days: number | null;
    objective: string | null;
    primary_kpi?: string | null;
    primary_kpi_label?: string | null;
    goal_label?: string | null;
    goal_threshold?: number | null;
    goal_unit?: string | null;
    goal_direction?: 'less_than' | 'greater_than' | null;
    goal_actual?: number | null;
    goal_hit?: boolean | null;
    goal_delta_pct?: number | null;
    /** Set when the objective's native KPI returned 0 results and we
     *  re-evaluated against a signal that actually moved. */
    kpi_fallback_from?: string | null;
    kpi_fallback_from_label?: string | null;
    kpi_fallback_to?: string | null;
    kpi_fallback_to_label?: string | null;
    kpi_fallback_note?: string | null;
    /** Always-on cross-KPI strip so even when the primary is 0 you can see
     *  what did happen. */
    other_signals?: {
      spend: number;
      impressions: number;
      clicks: number;
      leads: number;
      purchases: number;
      video_views: number;
    } | null;
  };
  data_quality: 'high' | 'medium' | 'low' | 'insufficient';
  data_quality_note?: string;
  /** What worked — patterns to lean into. */
  wins: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  /** What underperformed AND WHY — diagnostic, not blame. (Keeps the `misses`
   *  field name for backwards compat with patch #20–#26 storage.) */
  misses: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  /** Worth testing next — forward-looking action items. */
  recommendations: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  /** Optional plain-English observations about user override patterns (§8.3).
   *  Surfaces only — never auto-adjusts thresholds. */
  pattern_notes?: string[];
  generated_at: string;
}

interface OverridePatternRow {
  recommendation_action: string;
  override_count: number;
  snooze_count: number;
  top_reason_quick: string | null;
  top_format?: string | null;
  top_angle?: string | null;
}
interface OverridePatterns {
  by_action: OverridePatternRow[];
  total_overrides: number;
}

/** Parse a LUMI ad name: {YYYY-MM}_{Objective}_{AngleSlug}_{Format}_{Variant}. */
function parseLumiAdName(name: string | undefined | null): { angle: string | null; format: string | null } {
  if (!name || typeof name !== 'string') return { angle: null, format: null };
  const parts = name.split('_');
  if (parts.length < 5) return { angle: null, format: null };
  if (!/^\d{4}-\d{2}$/.test(parts[0])) return { angle: null, format: null };
  return { angle: parts[2] || null, format: parts[3] || null };
}

async function buildOverridePatterns(
  sb: any, brandId: string, performance: any,
): Promise<OverridePatterns | null> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await sb
    .from('recommendation_overrides')
    .select('recommendation_action, user_action, reason_quick, ad_id, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', since);
  if (error || !Array.isArray(rows) || rows.length === 0) return null;

  // Build ad_id -> {angle, format} from performance ads (best-effort).
  const adMeta = new Map<string, { angle: string | null; format: string | null }>();
  if (Array.isArray(performance?.ads)) {
    for (const a of performance.ads) {
      if (a?.ad_id) adMeta.set(String(a.ad_id), parseLumiAdName(a.ad_name));
    }
  }

  type Agg = {
    override_count: number;
    snooze_count: number;
    reasons: Map<string, number>;
    formats: Map<string, number>;
    angles: Map<string, number>;
  };
  const byAction = new Map<string, Agg>();
  for (const r of rows) {
    const action = String(r.recommendation_action || 'unknown');
    if (!byAction.has(action)) {
      byAction.set(action, {
        override_count: 0, snooze_count: 0,
        reasons: new Map(), formats: new Map(), angles: new Map(),
      });
    }
    const agg = byAction.get(action)!;
    const ua = String(r.user_action || '');
    if (ua === 'snoozed') agg.snooze_count++;
    else agg.override_count++;
    if (r.reason_quick) {
      const k = String(r.reason_quick);
      agg.reasons.set(k, (agg.reasons.get(k) || 0) + 1);
    }
    const meta = r.ad_id ? adMeta.get(String(r.ad_id)) : null;
    if (meta?.format) agg.formats.set(meta.format, (agg.formats.get(meta.format) || 0) + 1);
    if (meta?.angle) agg.angles.set(meta.angle, (agg.angles.get(meta.angle) || 0) + 1);
  }

  const top = (m: Map<string, number>): string | null => {
    let bestK: string | null = null; let bestV = 0;
    for (const [k, v] of m) if (v > bestV) { bestV = v; bestK = k; }
    return bestK;
  };

  const by_action: OverridePatternRow[] = [];
  for (const [action, agg] of byAction) {
    const total = agg.override_count + agg.snooze_count;
    if (total < 3) continue; // noise threshold
    by_action.push({
      recommendation_action: action,
      override_count: agg.override_count,
      snooze_count: agg.snooze_count,
      top_reason_quick: top(agg.reasons),
      top_format: top(agg.formats),
      top_angle: top(agg.angles),
    });
  }
  if (by_action.length === 0) return null;
  by_action.sort((a, b) => (b.override_count + b.snooze_count) - (a.override_count + a.snooze_count));
  return { by_action, total_overrides: rows.length };
}


async function canAccessBrand(sb: any, ownerId: string, userId: string, brandId: string): Promise<boolean> {
  if (ownerId === userId) return true;
  const { data: roleRow } = await sb.from('user_roles')
    .select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (roleRow) return true;
  const { data: teamRow } = await sb.from('brand_team_members')
    .select('id').eq('brand_id', brandId).eq('user_id', userId).eq('invite_status', 'accepted').maybeSingle();
  return !!teamRow;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve workspace.
    let workspaceId: string | null = body?.workspaceId ?? null;
    if (!workspaceId && body?.metaCampaignId && body?.brandId) {
      const { data: ownerCheck } = await sb.from('brands').select('id, user_id').eq('id', body.brandId).single();
      if (!ownerCheck || !(await canAccessBrand(sb, ownerCheck.user_id, user.id, body.brandId))) return json({ error: 'Forbidden' }, 403);
      const { data: existingWs } = await sb.from('campaign_workspaces').select('id, meta_campaign_ids').eq('brand_id', body.brandId);
      const found = (existingWs || []).find((w: any) => w?.meta_campaign_ids?.campaignId === body.metaCampaignId);
      if (found) {
        workspaceId = found.id;
      } else {
        let metaName = 'Imported campaign';
        try {
          const { data: brand } = await sb.from('brands').select('meta_access_token').eq('id', body.brandId).single();
          if (brand?.meta_access_token) {
            const r = await fetch(`https://graph.facebook.com/v25.0/${body.metaCampaignId}?fields=name,objective&access_token=${brand.meta_access_token}`);
            const d = await r.json();
            if (r.ok && d?.name) metaName = d.name;
          }
        } catch (_) { /* non-fatal */ }
        const { data: created, error: createErr } = await sb.from('campaign_workspaces').insert({
          brand_id: body.brandId, name: metaName, offer_name: metaName,
          meta_campaign_ids: { campaignId: body.metaCampaignId },
          archived: true, archived_at: new Date().toISOString(),
        }).select('id').single();
        if (createErr || !created) {
          console.error('Stub workspace creation failed:', createErr);
          return json({ error: 'Could not create workspace stub for this campaign' }, 500);
        }
        workspaceId = created.id;
      }
    }
    if (!workspaceId) return json({ error: 'Either workspaceId or (brandId + metaCampaignId) is required' }, 400);

    const { data: workspace, error: wErr } = await sb
      .from('campaign_workspaces')
      .select('id, brand_id, name, offer_name, creative_json, production_items, strategy_json, archived_at, created_at, meta_campaign_ids, objective')
      .eq('id', workspaceId).single();
    if (wErr || !workspace) return json({ error: 'Workspace not found' }, 404);

    const { data: brand, error: bErr } = await sb
      .from('brands').select('id, user_id, name, meta_account_id, meta_access_token')
      .eq('id', workspace.brand_id).single();
    if (bErr || !brand) return json({ error: 'Brand not found' }, 404);
    if (!(await canAccessBrand(sb, brand.user_id, user.id, brand.id))) return json({ error: 'Forbidden' }, 403);

    const metaCampaignId = (workspace.meta_campaign_ids as any)?.campaignId || null;

    // Goal resolution + persist override.
    let goal: GoalContext | null = null;
    if (body?.goalOverride && body.goalOverride.primary_kpi && body.goalOverride.primary_kpi_threshold != null) {
      goal = {
        kpi: String(body.goalOverride.primary_kpi),
        label: String(body.goalOverride.primary_kpi_label || KPI_LABELS[body.goalOverride.primary_kpi] || body.goalOverride.primary_kpi),
        threshold: Number(body.goalOverride.primary_kpi_threshold),
        direction: body.goalOverride.primary_kpi_goal_type === 'greater_than' ? 'greater_than' : 'less_than',
        unit: KPI_UNIT[body.goalOverride.primary_kpi] ?? '',
        source: 'override',
      };
      try {
        const { data: existingGoal } = await sb.from('campaign_goals').select('id').eq('workspace_id', workspaceId).maybeSingle();
        const goalRow = {
          workspace_id: workspaceId, brand_id: brand.id,
          primary_kpi: goal.kpi, primary_kpi_label: goal.label,
          primary_kpi_threshold: goal.threshold, primary_kpi_goal_type: goal.direction,
          created_by: user.id, auto_suggested: false, updated_at: new Date().toISOString(),
        };
        if (existingGoal?.id) await sb.from('campaign_goals').update(goalRow).eq('id', existingGoal.id);
        else await sb.from('campaign_goals').insert({ ...goalRow, created_at: new Date().toISOString() });
      } catch (e) { console.error('campaign_goals upsert failed (non-fatal):', e); }
    } else {
      const { data: goalRow } = await sb
        .from('campaign_goals').select('primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type')
        .eq('workspace_id', workspaceId).maybeSingle();
      if (goalRow && goalRow.primary_kpi && goalRow.primary_kpi_threshold != null) {
        goal = {
          kpi: String(goalRow.primary_kpi),
          label: String(goalRow.primary_kpi_label || KPI_LABELS[goalRow.primary_kpi] || goalRow.primary_kpi),
          threshold: Number(goalRow.primary_kpi_threshold),
          direction: goalRow.primary_kpi_goal_type === 'greater_than' ? 'greater_than' : 'less_than',
          unit: KPI_UNIT[goalRow.primary_kpi] ?? '',
          source: 'stored',
        };
      }
    }

    let metaCampaignObjective: string | null = (workspace as any).objective || null;
    if (metaCampaignId && brand.meta_access_token && !metaCampaignObjective) {
      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${metaCampaignId}?fields=objective&access_token=${brand.meta_access_token}`);
        const d = await r.json();
        if (r.ok && d?.objective) metaCampaignObjective = d.objective;
      } catch (_) { /* non-fatal */ }
    }

    const primaryKpi: string =
      goal?.kpi
      || LUMI_KPI_FROM_OBJECTIVE[String((workspace as any).objective || '')]
      || LUMI_KPI_FROM_OBJECTIVE[String(metaCampaignObjective || '')]
      || 'cpl';

    const dateRange = body?.dateRange && body.dateRange.start && body.dateRange.end
      ? { start: String(body.dateRange.start), end: String(body.dateRange.end) }
      : null;

    const performance = metaCampaignId && brand.meta_access_token
      ? await fetchCampaignPerformance(metaCampaignId, brand.meta_access_token, dateRange, primaryKpi)
      : null;

    // Guard: refuse to persist a retrospective if Meta data couldn't be trusted.
    // Without this, a transient Meta hiccup gets baked into a permanent
    // "Insufficient data" card the user can't recover from without manual help.
    if (metaCampaignId && brand.meta_access_token) {
      if (!performance) {
        console.warn(`[retrospective] refused to persist — Meta fetch failed for campaign ${metaCampaignId}`);
        return json({
          error: "We couldn't reach Meta to pull this campaign's results. Please try again in a moment.",
        }, 200);
      }
      const windowedSpend = performance?.totals?.spend ?? 0;
      if (windowedSpend === 0) {
        // Probe lifetime spend with date_preset=maximum. If the campaign actually
        // has spend on Meta but our window returned 0, treat it as a delivery
        // glitch (or a wrong/empty window) and bail out instead of saving zeros.
        try {
          const probeRes = await fetch(
            `https://graph.facebook.com/v25.0/${metaCampaignId}/insights?fields=spend&date_preset=maximum&level=campaign&access_token=${brand.meta_access_token}`,
          );
          const probeData = await probeRes.json();
          const lifetimeSpend = probeRes.ok
            ? Number(probeData?.data?.[0]?.spend || 0)
            : 0;
          console.log(`[retrospective] empty-window probe — campaign ${metaCampaignId}: windowed=$0, lifetime=$${lifetimeSpend.toFixed(2)}`);
          if (lifetimeSpend > 0) {
            console.warn(`[retrospective] refused to persist empty retro for campaign ${metaCampaignId} (lifetime spend=$${lifetimeSpend.toFixed(2)})`);
            return json({
              error: "Meta returned no spend for the selected window even though this campaign has lifetime spend. This usually clears up in a few minutes — please try again, or widen the date range.",
            }, 200);
          }
        } catch (probeErr) {
          console.error('[retrospective] lifetime probe failed:', probeErr);
          // If even the probe fails, treat the whole call as untrusted.
          return json({
            error: "We couldn't reach Meta to verify this campaign's results. Please try again in a moment.",
          }, 200);
        }
      }
    }

    const durationDays = computeDurationDays(performance, dateRange, workspace);

    // --- KPI auto-fallback ----------------------------------------------------
    // If the objective's native KPI returned ZERO results but another signal
    // actually moved (leads / purchases / clicks / video views), re-evaluate
    // the retro against that signal so the user sees a real debrief instead
    // of a card full of zeros. We label it clearly so it's never silent.
    let effectiveKpi = primaryKpi;
    let kpiFallback: {
      from: string; from_label: string; to: string; to_label: string; note: string;
    } | null = null;
    if (performance?.totals) {
      const t = performance.totals;
      const primaryResults = Number(t.results || 0);
      if (primaryResults === 0 && Number(t.spend || 0) > 0) {
        const fb = pickFallbackKpi(primaryKpi, t);
        if (fb && fb !== primaryKpi) {
          effectiveKpi = fb;
          // Recompute totals.results against the fallback so downstream
          // (stats.total_results, prompt summary) reflects the new KPI.
          t.results = recountResultsFor(fb, t);
          kpiFallback = {
            from: primaryKpi,
            from_label: KPI_LABELS[primaryKpi] || primaryKpi,
            to: fb,
            to_label: KPI_LABELS[fb] || fb,
            note: `Your objective was ${KPI_LABELS[primaryKpi] || primaryKpi}, but Meta reported 0 ${KPI_LABELS[primaryKpi]?.toLowerCase() || primaryKpi} results, so we evaluated against ${KPI_LABELS[fb] || fb} (which had real signal) instead.`,
          };
          // Also re-roll adset/ad breakdowns under the new KPI so the prompt's
          // per-row "results" + kpi_value reflect what we're actually judging.
          if (Array.isArray(performance.adsets)) {
            performance.adsets = performance.adsets.map((a: any) => {
              if (!a._kpi) return a;
              a._kpi.results = recountResultsFor(fb, a._kpi);
              return a;
            });
          }
          if (Array.isArray(performance.ads)) {
            performance.ads = performance.ads.map((a: any) => {
              if (!a._kpi) return a;
              a._kpi.results = recountResultsFor(fb, a._kpi);
              return a;
            });
          }
        }
      }
    }

    const actualValue = goal && performance?.totals
      ? extractKpiValue(performance.totals, goal.kpi)
      : performance?.totals
        ? extractKpiValue(performance.totals, effectiveKpi)
        : null;
    const goalEval = goal && actualValue != null ? evalGoal(goal, actualValue) : null;

    const dq = assessDataQuality({
      totalSpend: performance?.totals?.spend ?? 0,
      totalResults: performance?.totals?.results ?? 0,
      durationDays, goal,
    });

    // Override-pattern surfacing (§8.3) — read-only, never adjusts thresholds.
    // Skipped when data_quality is insufficient (no point pattern-matching on noise).
    const overridePatterns = dq.level === 'insufficient'
      ? null
      : await buildOverridePatterns(sb, brand.id, performance);

    const prompt = buildPrompt({
      brandName: brand.name,
      offerName: workspace.offer_name || workspace.name || 'Unnamed campaign',
      durationDays, dateRange,
      primaryKpi: effectiveKpi,
      primaryKpiLabel: KPI_LABELS[effectiveKpi] || effectiveKpi,
      goal, goalEval, dataQuality: dq,
      strategy: workspace.strategy_json,
      creative: workspace.creative_json,
      productionItems: workspace.production_items,
      performance,
      isImported: !workspace.creative_json,
      kpiFallback,
      overridePatterns,
    });


    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              "You are LUMI, a calm and honest ad strategist debriefing a campaign with the person who ran it. Speak in plain English — like you're explaining results to a small-business owner who runs their own ads, not a media buyer who lives in Ads Manager. Avoid jargon (or define it inline if you must use it). Frame underperformers as LEARNING signals — not failures — because every ad portfolio has a spread, and the value is in the patterns that inform what to make next. Be specific, ground claims in the data, and don't invent insights when the data is thin. Return ONLY valid JSON matching the schema in the user prompt.",
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
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative.slice(0, 2400) : '',
      stats: {
        total_spend: numberOr(parsed?.stats?.total_spend, performance?.totals?.spend ?? 0),
        total_results: Math.round(numberOr(parsed?.stats?.total_results, performance?.totals?.results ?? 0)),
        avg_cpl: actualValue,
        duration_days: durationDays,
        objective: workspace.strategy_json?.objective || metaCampaignObjective || performance?.totals?.objective || null,
        primary_kpi: effectiveKpi,
        primary_kpi_label: KPI_LABELS[effectiveKpi] || effectiveKpi,
        goal_label: goal?.label ?? null,
        goal_threshold: goal?.threshold ?? null,
        goal_unit: goal?.unit ?? null,
        goal_direction: goal?.direction ?? null,
        goal_actual: actualValue,
        goal_hit: goalEval?.hit ?? null,
        goal_delta_pct: goalEval?.deltaPct ?? null,
        kpi_fallback_from: kpiFallback?.from ?? null,
        kpi_fallback_from_label: kpiFallback?.from_label ?? null,
        kpi_fallback_to: kpiFallback?.to ?? null,
        kpi_fallback_to_label: kpiFallback?.to_label ?? null,
        kpi_fallback_note: kpiFallback?.note ?? null,
        other_signals: performance?.totals ? {
          spend: Number(performance.totals.spend || 0),
          impressions: Number(performance.totals.impressions || 0),
          clicks: Number(performance.totals.clicks || 0),
          leads: Number(performance.totals.leads || 0),
          purchases: Number(performance.totals.purchases || 0),
          video_views: Number(performance.totals.video_views || 0),
        } : null,
      },
      data_quality: dq.level,
      data_quality_note: dq.note,

      wins: normalizeBullets(parsed.wins),
      misses: normalizeBullets(parsed.underperformers || parsed.misses),
      recommendations: normalizeBullets(parsed.test_ideas || parsed.recommendations),
      pattern_notes: Array.isArray(parsed.pattern_notes)
        ? parsed.pattern_notes
            .filter((x: any) => typeof x === 'string' && x.trim().length > 0)
            .slice(0, 4)
            .map((x: string) => x.slice(0, 500))
        : [],
      generated_at: new Date().toISOString(),
    };

    await sb.from('campaign_workspaces').update({
      retrospective_json: retrospective,
      retrospective_generated_at: retrospective.generated_at,
    }).eq('id', workspaceId);

    await sb.from('brand_learnings').update({ is_active: false }).eq('source_workspace_id', workspaceId);

    if (retrospective.data_quality !== 'insufficient') {
      const rows: any[] = [];
      const pushAll = (arr: typeof retrospective.wins, category: 'win' | 'miss' | 'recommendation') => {
        arr.forEach(b => rows.push({
          brand_id: brand.id, source_workspace_id: workspaceId, category,
          insight: b.insight, supporting_data: b.supporting_data || null,
          confidence: b.confidence, is_active: true,
        }));
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

interface GoalContext {
  kpi: string; label: string; threshold: number;
  direction: 'less_than' | 'greater_than';
  unit: '$' | 'x' | '%' | ''; source: 'stored' | 'override';
}

function evalGoal(goal: GoalContext, actual: number): { hit: boolean; deltaPct: number } {
  const hit = goal.direction === 'less_than' ? actual <= goal.threshold : actual >= goal.threshold;
  const deltaPct = goal.threshold === 0 ? 0 : ((actual - goal.threshold) / goal.threshold) * 100;
  return { hit, deltaPct: Math.round(deltaPct * 10) / 10 };
}

function extractKpiValue(totals: any, kpi: string): number | null {
  if (!totals) return null;
  switch (kpi) {
    case 'cpl': return numberish(totals.cpl_value);
    case 'cpp': return numberish(totals.cpp_value);
    case 'cpc': return numberish(totals.cpc);
    case 'cpm': return numberish(totals.cpm);
    case 'ctr': return numberish(totals.ctr);
    case 'roas': return numberish(totals.roas);
    case 'costPerThruPlay': return numberish(totals.costPerThruPlay);
    default: return numberish(totals.cpl_value);
  }
}
function numberish(v: any): number | null {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

// Choose a fallback KPI when the campaign's native KPI returned zero results.
// Priority: stay close to commercial intent (purchases > leads), then clicks,
// then video views. We only fall back to a signal that actually moved.
function pickFallbackKpi(currentKpi: string, totals: any): string | null {
  const purchases = Number(totals?.purchases || 0);
  const leads = Number(totals?.leads || 0);
  const clicks = Number(totals?.clicks || 0);
  const videoViews = Number(totals?.video_views || 0);
  const candidates: Array<{ kpi: string; count: number }> = [];
  if (currentKpi !== 'cpp' && currentKpi !== 'roas' && purchases > 0) candidates.push({ kpi: 'cpp', count: purchases });
  if (currentKpi !== 'cpl' && leads > 0) candidates.push({ kpi: 'cpl', count: leads });
  if (currentKpi !== 'cpc' && currentKpi !== 'ctr' && clicks > 0) candidates.push({ kpi: 'cpc', count: clicks });
  if (currentKpi !== 'costPerThruPlay' && videoViews > 0) candidates.push({ kpi: 'costPerThruPlay', count: videoViews });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.count - a.count);
  // If the native KPI was sales/purchases but only leads exist, prefer leads
  // (commercial-adjacent) over clicks even if clicks count is higher.
  if ((currentKpi === 'roas' || currentKpi === 'cpp') && leads > 0) return 'cpl';
  return candidates[0].kpi;
}

function recountResultsFor(kpi: string, totals: any): number {
  switch (kpi) {
    case 'cpl': return Number(totals?.leads || 0);
    case 'cpp':
    case 'roas': return Number(totals?.purchases || 0);
    case 'cpc':
    case 'ctr': return Number(totals?.clicks || 0);
    case 'cpm': return Number(totals?.impressions || 0);
    case 'costPerThruPlay': return Number(totals?.video_views || 0);
    default: return Number(totals?.leads || 0);
  }
}


function assessDataQuality(args: {
  totalSpend: number; totalResults: number; durationDays: number | null; goal: GoalContext | null;
}): { level: RetrospectiveJSON['data_quality']; note?: string } {
  const reasons: string[] = [];
  if (args.totalSpend < 50) reasons.push(`Total spend was only $${args.totalSpend.toFixed(2)}`);
  if (args.totalResults < 30) reasons.push(`Only ${Math.round(args.totalResults)} results recorded (threshold for stat-sig comparison is ~30)`);
  if (args.durationDays != null && args.durationDays < 7) reasons.push(`Campaign ran for only ${args.durationDays} day${args.durationDays === 1 ? '' : 's'} — Meta's algorithm typically needs 7+ days to optimize`);
  if (args.goal && args.totalSpend > 0 && args.goal.unit === '$' && args.goal.threshold > 0) {
    const expectedConversions = args.totalSpend / args.goal.threshold;
    if (expectedConversions < 10) {
      reasons.push(`At your $${args.goal.threshold.toFixed(2)} ${args.goal.label} target, the spend supports at most ${Math.floor(expectedConversions)} conversions — too few to evaluate the goal honestly`);
    }
  }
  if (reasons.length === 0) return { level: 'high' };
  if (reasons.length === 1) return { level: 'medium', note: reasons[0] };
  if (args.totalResults < 10 || args.totalSpend < 25) return { level: 'insufficient', note: reasons.join('. ') + '.' };
  return { level: 'low', note: reasons.join('. ') + '.' };
}

function computeDurationDays(
  performance: any, dateRange: { start: string; end: string } | null, workspace: any,
): number | null {
  const t = performance?.totals;
  if (t?.date_start && t?.date_stop) {
    const a = new Date(t.date_start).getTime();
    const b = new Date(t.date_stop).getTime();
    if (isFinite(a) && isFinite(b) && b >= a) return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
  }
  if (dateRange) {
    const a = new Date(dateRange.start).getTime();
    const b = new Date(dateRange.end).getTime();
    if (isFinite(a) && isFinite(b) && b >= a) return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
  }
  if (workspace?.created_at) {
    const startedAt = new Date(workspace.created_at);
    const endedAt = workspace?.archived_at ? new Date(workspace.archived_at) : new Date();
    return Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));
  }
  return null;
}

async function fetchCampaignPerformance(
  metaCampaignId: string, accessToken: string,
  dateRange: { start: string; end: string } | null, primaryKpi: string,
) {
  const fields = [
    'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks',
    'ctr', 'cpc', 'cpm', 'actions', 'cost_per_action_type',
    'purchase_roas', 'objective', 'date_start', 'date_stop',
  ].join(',');
  const timeParam = dateRange
    ? `time_range=${encodeURIComponent(JSON.stringify({ since: dateRange.start, until: dateRange.end }))}`
    : `date_preset=maximum`;

  try {
    const campaignRes = await fetch(`https://graph.facebook.com/v25.0/${metaCampaignId}/insights?fields=${fields}&${timeParam}&level=campaign&access_token=${accessToken}`);
    const campaignData = await campaignRes.json();
    if (!campaignRes.ok) {
      console.error('Meta campaign insights fetch failed:', campaignData);
      return null;
    }
    const adsetRes = await fetch(`https://graph.facebook.com/v25.0/${metaCampaignId}/insights?fields=${fields},adset_id,adset_name&${timeParam}&level=adset&access_token=${accessToken}`);
    const adsetData = await adsetRes.json();
    const adRes = await fetch(`https://graph.facebook.com/v25.0/${metaCampaignId}/insights?fields=${fields},ad_id,ad_name,adset_id&${timeParam}&level=ad&access_token=${accessToken}`);
    const adData = await adRes.json();

    const c = campaignData?.data?.[0];
    const totals = c ? rollupRow(c, primaryKpi) : null;

    if (totals && totals.spend > 0 && totals.results === 0) {
      const seenActionTypes = (Array.isArray(c?.actions) ? c.actions : []).map((a: any) => a.action_type);
      console.warn(
        `[retrospective] zero results despite $${totals.spend.toFixed(2)} spend on campaign ${metaCampaignId} (kpi=${primaryKpi}). Action types Meta returned:`,
        seenActionTypes,
      );
    }

    return {
      totals,
      adsets: (adsetData?.data || []).map((a: any) => ({ ...a, _kpi: rollupRow(a, primaryKpi) })),
      ads: (adData?.data || []).map((a: any) => ({ ...a, _kpi: rollupRow(a, primaryKpi) })),
    };
  } catch (err) {
    console.error('Meta API fetch failed:', err);
    return null;
  }
}

function sumActions(actions: any[], types: string[]): number {
  if (!Array.isArray(actions)) return 0;
  return types.reduce((sum, t) => {
    const a = actions.find((x: any) => x.action_type === t);
    return sum + (a ? Number(a.value) || 0 : 0);
  }, 0);
}

function firstCpa(cpa: any[], types: string[]): number | null {
  if (!Array.isArray(cpa)) return null;
  for (const t of types) {
    const a = cpa.find((x: any) => x.action_type === t);
    if (a?.value) {
      const n = Number(a.value);
      if (isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function rollupRow(row: any, primaryKpi: string) {
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const cpa = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const spend = Number(row.spend || 0);
  const leadCount = sumActions(actions, LEAD_ACTION_TYPES);
  const purchaseCount = sumActions(actions, PURCHASE_ACTION_TYPES);
  const videoViewCount = sumActions(actions, VIDEO_VIEW_ACTION_TYPES);
  const cplValue = firstCpa(cpa, LEAD_ACTION_TYPES) ?? (leadCount > 0 ? spend / leadCount : null);
  const cppValue = firstCpa(cpa, PURCHASE_ACTION_TYPES) ?? (purchaseCount > 0 ? spend / purchaseCount : null);
  const costPerThruPlay = firstCpa(cpa, VIDEO_VIEW_ACTION_TYPES) ?? (videoViewCount > 0 ? spend / videoViewCount : null);
  const purchaseRoas = Array.isArray(row.purchase_roas) && row.purchase_roas.length
    ? Number(row.purchase_roas[0]?.value || 0) || null : null;

  let results = 0;
  switch (primaryKpi) {
    case 'cpl': results = leadCount; break;
    case 'cpp': results = purchaseCount; break;
    case 'cpc': results = Number(row.clicks || 0); break;
    case 'cpm': results = Number(row.impressions || 0); break;
    case 'ctr': results = Number(row.clicks || 0); break;
    case 'roas': results = purchaseCount; break;
    case 'costPerThruPlay': results = videoViewCount; break;
    default: results = leadCount;
  }

  return {
    spend, impressions: Number(row.impressions || 0), clicks: Number(row.clicks || 0),
    ctr: Number(row.ctr || 0), cpc: Number(row.cpc || 0), cpm: Number(row.cpm || 0),
    cpl_value: cplValue, cpp_value: cppValue, costPerThruPlay,
    roas: purchaseRoas,
    leads: leadCount, purchases: purchaseCount, video_views: videoViewCount,
    results, objective: row.objective,
    date_start: row.date_start, date_stop: row.date_stop,
  };
}

// ---------------------------------------------------------------------------
// Prompt construction — reframed.
// ---------------------------------------------------------------------------

function buildPrompt(args: {
  brandName: string; offerName: string;
  durationDays: number | null; dateRange: { start: string; end: string } | null;
  primaryKpi: string; primaryKpiLabel: string;
  goal: GoalContext | null;
  goalEval: { hit: boolean; deltaPct: number } | null;
  dataQuality: { level: string; note?: string };
  strategy: any; creative: any; productionItems: any; performance: any; isImported: boolean;
  kpiFallback?: { from: string; from_label: string; to: string; to_label: string; note: string } | null;

}): string {
  const goalLine = args.goal
    ? `Stated goal: ${args.goal.label} ${args.goal.direction === 'less_than' ? 'at or below' : 'at or above'} ${formatGoalValue(args.goal)}.${
        args.goalEval
          ? ` Actual: ${formatActualValue(args.goal, args.performance?.totals)} — ${args.goalEval.hit ? 'GOAL HIT' : 'goal missed'} by ${Math.abs(args.goalEval.deltaPct).toFixed(1)}%.`
          : ' (Actual not computable — likely thin data.)'
      }`
    : `No explicit goal was set. Primary KPI for this analysis is ${args.primaryKpiLabel}.`;

  const summary = {
    brand: args.brandName, offer: args.offerName,
    duration_days: args.durationDays, date_range: args.dateRange,
    primary_kpi: args.primaryKpi, primary_kpi_label: args.primaryKpiLabel,
    note: args.isImported
      ? "This campaign wasn't built in LUMI — only the Meta numbers + ad/adset names are available. Use those as your signals."
      : null,
    strategy_objective: args.strategy?.objective || args.performance?.totals?.objective || 'unknown',
    strategy_audiences: args.strategy?.audiences || args.strategy?.audience_set || null,
    angles: Array.isArray(args.creative?.angles)
      ? args.creative.angles.map((a: any) => ({ name: a.name || a.angle_name, hook: a.hook || a.opening, format: a.format }))
      : [],
    production_count: Array.isArray(args.productionItems) ? args.productionItems.length : 0,
    performance_totals: args.performance?.totals || null,
    adset_breakdown: (args.performance?.adsets || []).slice(0, 10).map((a: any) => ({
      name: a.adset_name, spend: a._kpi?.spend ?? Number(a.spend || 0),
      results: a._kpi?.results ?? 0, kpi_value: a._kpi ? extractKpiValue(a._kpi, args.primaryKpi) : null,
    })),
    ad_breakdown: (args.performance?.ads || []).slice(0, 20).map((a: any) => ({
      name: a.ad_name, adset: a.adset_id,
      spend: a._kpi?.spend ?? Number(a.spend || 0),
      results: a._kpi?.results ?? 0, kpi_value: a._kpi ? extractKpiValue(a._kpi, args.primaryKpi) : null,
      ctr: a._kpi?.ctr ?? Number(a.ctr || 0),
    })),
  };

  return `Debrief this Meta ads campaign for the person who ran it.

PRIMARY KPI: ${args.primaryKpiLabel} (${args.primaryKpi}). Every "result" reference should refer to this metric — do NOT substitute a different metric.
${args.kpiFallback ? `\nIMPORTANT — KPI FALLBACK APPLIED: The campaign's objective KPI was ${args.kpiFallback.from_label}, but Meta reported zero ${args.kpiFallback.from_label.toLowerCase()} results. We've evaluated this debrief against ${args.kpiFallback.to_label} instead, since that signal actually moved. In your narrative, explicitly call this out in plain English near the top (e.g. "Heads up — your campaign was set up for ${args.kpiFallback.from_label.toLowerCase()}, but Meta didn't track any. We're looking at ${args.kpiFallback.to_label.toLowerCase()} instead because that's where the real signal showed up."). Then proceed with the debrief.\n` : ''}
${goalLine}


Pre-computed data quality: ${args.dataQuality.level.toUpperCase()}${args.dataQuality.note ? ` — ${args.dataQuality.note}` : ''}

Campaign data:
${JSON.stringify(summary, null, 2)}

Return a JSON object with this EXACT shape (no prose, no code fences):

{
  "summary": "ONE sentence. Plain English. The single most important takeaway.",
  "narrative": "2-3 short paragraphs in plain English. Read like a calm coach giving a debrief. Cover: what happened overall, what the numbers tell us about audience + creative resonance, and where the user should focus next. Avoid jargon — if you must use a term like 'frequency' or 'lookalike,' explain it inline once. No headers, no bullet lists inside the narrative — just paragraphs.",
  "stats": { "total_spend": number, "total_results": number, "avg_cpl": number or null, "duration_days": number or null, "objective": string or null },
  "wins": [
    { "insight": "What worked, in plain English.", "supporting_data": "The specific numbers / ad names that show this.", "confidence": "high"|"medium"|"low" }
  ],
  "underperformers": [
    { "insight": "What underperformed AND WHY (or your best read of why).", "supporting_data": "The specific numbers / ad names that show this.", "confidence": "..." }
  ],
  "test_ideas": [
    { "insight": "Specific thing to test in the next round of creative or audiences.", "supporting_data": "What in this campaign's data points to this idea.", "confidence": "..." }
  ]
}

WRITING RULES (read these every time):

1. **Plain English.** Write like you're talking to a small-business owner who runs their own ads, not a media buyer. Don't say "CTR is below benchmark" — say "fewer people clicked than usual." Define jargon inline if you must use it.

2. **Underperformers are LEARNING, not failures.** Every ad portfolio has a spread. The point of calling out underperformers is to extract the pattern (which audience? which hook style? which format?) — NOT to make the user feel bad about ads that lost. Frame it like "this didn't land — here's our best read on why" not "this failed."

3. **Test ideas should be SPECIFIC.** "Try a different hook" is useless. "Try a question-style hook for the discovery-call audience — your statement-style hooks (Ad C, Ad F) outperformed by 40% on CTR there" is useful.

4. **Honor the data quality flag.** If "insufficient": leave wins/underperformers/test_ideas as empty arrays AND use the narrative to explain (in plain English) what's needed before a confident debrief is possible.

5. **Cite the numbers.** Reference specific ad names, adset names, spend, KPI values. Generic advice is worthless.

6. **Confidence levels.** "high" = data clearly supports it. "medium" = default. "low" = thin pattern but worth flagging.

Aim for 2-3 wins, 2-3 underperformers, 3-5 test_ideas when data supports them. Fewer when it doesn't. Never fill quotas with weak insights. Return ONLY the JSON.`;
}

function formatGoalValue(goal: GoalContext): string {
  if (goal.unit === '$') return `$${goal.threshold.toFixed(2)}`;
  if (goal.unit === 'x') return `${goal.threshold.toFixed(2)}x`;
  if (goal.unit === '%') return `${goal.threshold.toFixed(2)}%`;
  return String(goal.threshold);
}
function formatActualValue(goal: GoalContext, totals: any): string {
  const v = extractKpiValue(totals, goal.kpi);
  if (v == null) return 'unknown';
  return formatGoalValue({ ...goal, threshold: v });
}
