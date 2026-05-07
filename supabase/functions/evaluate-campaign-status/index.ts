import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// evaluate-campaign-status (Patch #28 — the brain)
//
// Implements docs/lumi-decision-playbook.md §6 (rules) and returns the API
// in §7. Single source of truth for status + recommendation logic.
// Performance dashboard, weekly email, and campaign retrospective all call
// this — they differ in time window + depth, not in logic.
//
// Inputs (one of):
//   { workspaceId, primaryGoal?, primaryDirection?, attributionWindow?, asOf? }
//   { brandId, metaCampaignId, primaryGoal?, primaryDirection?, attributionWindow?, asOf? }
//
// When primaryGoal isn't passed, the function loads it from campaign_goals
// for the workspace. When neither is available, it falls back to a benchmark
// from the LUMI KPI map (so analysis still works for never-set-a-goal users).
//
// Returns: { campaign, adsets[], ads[], topRecommendation }
// ============================================================================

// ---------------------------------------------------------------------------
// Constants — KPI vocab + action types (mirror of patch #27, kept in sync
// intentionally since edge functions can't import from src/).
// ---------------------------------------------------------------------------

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

const KPI_DEFAULT_DIRECTION: Record<string, 'less_than' | 'greater_than'> = {
  cpl: 'less_than', cpp: 'less_than', cpc: 'less_than', cpm: 'less_than',
  costPerThruPlay: 'less_than', roas: 'greater_than', ctr: 'greater_than',
};

// Sensible benchmark goal when no goal is set. From src/lib/lumi-kpi-config.ts.
const KPI_DEFAULT_GOAL: Record<string, number> = {
  cpl: 15, cpp: 25, cpc: 0.5, cpm: 8, costPerThruPlay: 0.05, roas: 2.5, ctr: 1.0,
};

// Secondary KPI per primary KPI — playbook §3.
const SECONDARY_KPI_FOR: Record<string, string | null> = {
  cpl: 'cpp',           // lead campaign — show purchases as secondary
  cpp: 'roas',          // purchase campaign — show ROAS
  roas: 'cpp',          // ROAS campaign — show CPP for context
  cpc: 'cvr_proxy',     // traffic — show site conversion rate (best effort)
  cpm: null,            // engagement / reach — no secondary
  ctr: null,
  costPerThruPlay: null,
};

const LEAD_ACTION_TYPES = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'onsite_conversion.lead', 'submit_application_total'];
const PURCHASE_ACTION_TYPES = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.purchase', 'omni_purchase'];
const VIDEO_VIEW_ACTION_TYPES = ['video_view', 'video_thruplay_watched_actions'];

// ---------------------------------------------------------------------------
// Types — mirror of playbook §7.
// ---------------------------------------------------------------------------

type Status =
  | 'learning' | 'scaling_ready' | 'performing' | 'promising'
  | 'underperforming' | 'fatigued' | 'spend_starved';

type Action =
  | 'turn_off' | 'promote_to_scaling' | 'add_similar_variants'
  | 'increase_budget' | 'hold' | 'wait' | 'refresh_creative'
  | 'push_delivery' | 'broaden_audience' | 'reduce_budget';

interface AdEvaluation {
  id: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  status: Status;
  primary: { value: number | null; vsGoalPct: number | null; trendDirection: 'up' | 'down' | 'flat' };
  secondary: { value: number | null; label: string } | null;
  reach: number;
  daysLive: number;
  windows: {
    short: WindowSnapshot;
    medium: WindowSnapshot;
    long: WindowSnapshot;
  };
  recommendation: {
    action: Action;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
    impact: number;
    impactReasoning: string;
    priorityTier: 1 | 2 | 3 | 4 | 5; // 1 = spend_starved, 2 = underperformer, 3 = fatigue, 4 = scaling_ready, 5 = no-priority (learning/performing/promising)
  };
}

interface WindowSnapshot {
  spend: number;
  results: number;
  kpiValue: number | null;
  date_start?: string;
  date_stop?: string;
}

// ---------------------------------------------------------------------------
// HTTP entry
// ---------------------------------------------------------------------------

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

    // Resolve campaign + brand + ownership.
    const { brandId, metaCampaignId, workspaceId, accessToken, primaryKpiOverride, primaryGoal: goalIn, primaryDirection: directionIn, attributionWindow, asOf } =
      await resolveContext(body, sb, user.id);

    if (!metaCampaignId || !accessToken) {
      return json({ error: 'Could not resolve a connected Meta campaign for this request' }, 400);
    }

    // Resolve campaign metadata (status, objective, budget structure → ABO/CBO).
    const meta = await fetchCampaignMeta(metaCampaignId, accessToken);
    const campaignType: 'ABO' | 'CBO' = meta.daily_budget || meta.lifetime_budget ? 'CBO' : 'ABO';

    // Resolve primary KPI: input override > stored goal > inferred from objective.
    let primaryKpi: string;
    let primaryGoal: number;
    let primaryDirection: 'less_than' | 'greater_than';

    if (primaryKpiOverride && goalIn != null) {
      primaryKpi = primaryKpiOverride;
      primaryGoal = goalIn;
      primaryDirection = directionIn ?? KPI_DEFAULT_DIRECTION[primaryKpi] ?? 'less_than';
    } else if (workspaceId) {
      const { data: goalRow } = await sb
        .from('campaign_goals')
        .select('primary_kpi, primary_kpi_threshold, primary_kpi_goal_type')
        .eq('workspace_id', workspaceId).maybeSingle();
      if (goalRow?.primary_kpi && goalRow.primary_kpi_threshold != null) {
        primaryKpi = String(goalRow.primary_kpi);
        primaryGoal = Number(goalRow.primary_kpi_threshold);
        primaryDirection = goalRow.primary_kpi_goal_type === 'greater_than' ? 'greater_than' : 'less_than';
      } else {
        primaryKpi = LUMI_KPI_FROM_OBJECTIVE[meta.objective || ''] || 'cpl';
        primaryGoal = KPI_DEFAULT_GOAL[primaryKpi] ?? 15;
        primaryDirection = KPI_DEFAULT_DIRECTION[primaryKpi] ?? 'less_than';
      }
    } else {
      primaryKpi = LUMI_KPI_FROM_OBJECTIVE[meta.objective || ''] || 'cpl';
      primaryGoal = KPI_DEFAULT_GOAL[primaryKpi] ?? 15;
      primaryDirection = KPI_DEFAULT_DIRECTION[primaryKpi] ?? 'less_than';
    }

    const secondaryKpi = SECONDARY_KPI_FOR[primaryKpi] || null;

    // Compute the four windows (3-day, 7-day, 30-day, fatigue-ref = prior 14 days).
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const windows = computeWindows(asOfDate);

    // Pull insights at all three levels for the three primary windows + the fatigue ref.
    const [c3, c7, c30, cFatigueRef] = await Promise.all([
      fetchInsights(metaCampaignId, accessToken, windows.short, 'campaign'),
      fetchInsights(metaCampaignId, accessToken, windows.medium, 'campaign'),
      fetchInsights(metaCampaignId, accessToken, windows.long, 'campaign'),
      fetchInsights(metaCampaignId, accessToken, windows.fatigueRef, 'campaign'),
    ]);
    const [s3, s7, s30, sFatigueRef] = await Promise.all([
      fetchInsights(metaCampaignId, accessToken, windows.short, 'adset'),
      fetchInsights(metaCampaignId, accessToken, windows.medium, 'adset'),
      fetchInsights(metaCampaignId, accessToken, windows.long, 'adset'),
      fetchInsights(metaCampaignId, accessToken, windows.fatigueRef, 'adset'),
    ]);
    const [a3, a7, a30, aFatigueRef] = await Promise.all([
      fetchInsights(metaCampaignId, accessToken, windows.short, 'ad'),
      fetchInsights(metaCampaignId, accessToken, windows.medium, 'ad'),
      fetchInsights(metaCampaignId, accessToken, windows.long, 'ad'),
      fetchInsights(metaCampaignId, accessToken, windows.fatigueRef, 'ad'),
    ]);

    // Pull adset metadata so we can detect testing/scaling type, audience temp, daily budget.
    const adsetMeta = await fetchAdsetMeta(metaCampaignId, accessToken);
    const adMeta = await fetchAdMeta(metaCampaignId, accessToken);

    // Evaluate each ad.
    const adEvaluations: AdEvaluation[] = (a30 as any[]).map(adRow => {
      const id = adRow.ad_id;
      const meta3 = (a3 as any[]).find(r => r.ad_id === id);
      const meta7 = (a7 as any[]).find(r => r.ad_id === id);
      const meta30 = adRow;
      const metaFatigueRef = (aFatigueRef as any[]).find(r => r.ad_id === id);
      const adInfo = adMeta.find(m => m.id === id);
      const parentAdset = adsetMeta.find(s => s.id === adInfo?.adset_id);
      return classify({
        id, name: adInfo?.name || adRow.ad_name || id,
        level: 'ad',
        primaryKpi, primaryGoal, primaryDirection,
        secondaryKpi,
        meta3, meta7, meta30, metaFatigueRef,
        adsetType: detectAdsetType(parentAdset?.name),
        audienceTemp: detectAudienceTemp(parentAdset?.name, parentAdset?.targeting),
        adsetDailyBudget: numberish(parentAdset?.daily_budget) ?? 0,
        campaignType,
        adInfo,
      });
    });

    // Evaluate each adset.
    const adsetEvaluations: AdEvaluation[] = (s30 as any[]).map(asRow => {
      const id = asRow.adset_id;
      const meta3 = (s3 as any[]).find(r => r.adset_id === id);
      const meta7 = (s7 as any[]).find(r => r.adset_id === id);
      const meta30 = asRow;
      const metaFatigueRef = (sFatigueRef as any[]).find(r => r.adset_id === id);
      const adsetInfo = adsetMeta.find(s => s.id === id);
      return classify({
        id, name: adsetInfo?.name || asRow.adset_name || id,
        level: 'adset',
        primaryKpi, primaryGoal, primaryDirection, secondaryKpi,
        meta3, meta7, meta30, metaFatigueRef,
        adsetType: detectAdsetType(adsetInfo?.name),
        audienceTemp: detectAudienceTemp(adsetInfo?.name, adsetInfo?.targeting),
        adsetDailyBudget: numberish(adsetInfo?.daily_budget) ?? 0,
        campaignType,
      });
    });

    // Evaluate the campaign.
    const campaignEvaluation = classify({
      id: metaCampaignId,
      name: meta.name || 'Campaign',
      level: 'campaign',
      primaryKpi, primaryGoal, primaryDirection, secondaryKpi,
      meta3: c3?.[0], meta7: c7?.[0], meta30: c30?.[0], metaFatigueRef: cFatigueRef?.[0],
      adsetType: 'unknown',
      audienceTemp: 'unknown',
      adsetDailyBudget: numberish(meta.daily_budget) ?? 0,
      campaignType,
    });

    // Pick top recommendation across all evaluations using tiered priority (§7).
    const topRecommendation = pickTopRecommendation([
      ...adEvaluations, ...adsetEvaluations, campaignEvaluation,
    ]);

    return json({
      success: true,
      meta: { primaryKpi, primaryKpiLabel: KPI_LABELS[primaryKpi], primaryGoal, primaryDirection, secondaryKpi, campaignType, asOf: asOfDate.toISOString() },
      campaign: campaignEvaluation,
      adsets: adsetEvaluations,
      ads: adEvaluations,
      topRecommendation,
    });
  } catch (err: any) {
    console.error('evaluate-campaign-status error:', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Context resolution
// ---------------------------------------------------------------------------

async function resolveContext(body: any, sb: any, userId: string) {
  let metaCampaignId: string | null = body?.metaCampaignId ?? null;
  let workspaceId: string | null = body?.workspaceId ?? null;
  let brandId: string | null = body?.brandId ?? null;
  let accessToken: string | null = null;

  if (workspaceId) {
    const { data: ws } = await sb
      .from('campaign_workspaces')
      .select('id, brand_id, meta_campaign_ids, objective')
      .eq('id', workspaceId).single();
    if (!ws) throw new Error('Workspace not found');
    brandId = ws.brand_id;
    metaCampaignId ||= (ws.meta_campaign_ids as any)?.campaignId || null;
  }
  if (!brandId) throw new Error('brandId or workspaceId is required');

  const { data: brand } = await sb
    .from('brands').select('id, user_id, meta_access_token').eq('id', brandId).single();
  if (!brand) throw new Error('Brand not found');
  if (brand.user_id !== userId) throw new Error('Forbidden');
  accessToken = brand.meta_access_token;

  return {
    brandId, workspaceId, metaCampaignId, accessToken,
    primaryKpiOverride: body?.primaryKpi as string | undefined,
    primaryGoal: body?.primaryGoal as number | undefined,
    primaryDirection: body?.primaryDirection as 'less_than' | 'greater_than' | undefined,
    attributionWindow: body?.attributionWindow as string | undefined,
    asOf: body?.asOf as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Window math — playbook §2 (3 / 7 / 30 days, plus fatigue ref = prior 14 days)
// ---------------------------------------------------------------------------

interface DateWindow { since: string; until: string; days: number; }

function computeWindows(asOf: Date) {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const subtractDays = (n: number) => {
    const d = new Date(asOf);
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };
  // The "until" is yesterday so we don't compare on a partial day.
  const until = subtractDays(1);
  const w = (n: number): DateWindow => ({ since: fmt(subtractDays(n)), until: fmt(until), days: n });
  // Fatigue ref = the 14 days before the medium window's "since."
  const mediumSince = subtractDays(7);
  const fatigueUntil = subtractDays(8);
  const fatigueSince = subtractDays(21);
  return {
    short: w(3),
    medium: w(7),
    long: w(30),
    fatigueRef: { since: fmt(fatigueSince), until: fmt(fatigueUntil), days: 14 },
  };
}

// ---------------------------------------------------------------------------
// Meta API helpers
// ---------------------------------------------------------------------------

async function fetchCampaignMeta(metaCampaignId: string, accessToken: string) {
  const fields = 'id,name,objective,status,daily_budget,lifetime_budget,bid_strategy,created_time';
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${metaCampaignId}?fields=${fields}&access_token=${accessToken}`);
    return await res.json();
  } catch (err) {
    console.error('campaign meta fetch failed:', err);
    return {};
  }
}

async function fetchAdsetMeta(metaCampaignId: string, accessToken: string) {
  const fields = 'id,name,daily_budget,lifetime_budget,targeting,status';
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${metaCampaignId}/adsets?fields=${fields}&limit=200&access_token=${accessToken}`);
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch (err) {
    console.error('adset meta fetch failed:', err);
    return [];
  }
}

async function fetchAdMeta(metaCampaignId: string, accessToken: string) {
  const fields = 'id,name,adset_id,status,created_time';
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${metaCampaignId}/ads?fields=${fields}&limit=500&access_token=${accessToken}`);
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch (err) {
    console.error('ad meta fetch failed:', err);
    return [];
  }
}

async function fetchInsights(
  metaCampaignId: string, accessToken: string, window: DateWindow,
  level: 'campaign' | 'adset' | 'ad',
) {
  const baseFields = ['campaign_id', 'spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'frequency', 'actions', 'cost_per_action_type', 'purchase_roas', 'date_start', 'date_stop'];
  const fields = level === 'adset' ? [...baseFields, 'adset_id', 'adset_name']
    : level === 'ad' ? [...baseFields, 'ad_id', 'ad_name', 'adset_id']
    : [...baseFields, 'campaign_name', 'objective'];

  const url =
    `https://graph.facebook.com/v21.0/${metaCampaignId}/insights` +
    `?level=${level}` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since: window.since, until: window.until }))}` +
    `&fields=${fields.join(',')}` +
    `&limit=500&access_token=${accessToken}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch (err) {
    console.error(`insights fetch failed (level=${level}):`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers shared with the retrospective code
// ---------------------------------------------------------------------------

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
function numberish(v: any): number | null {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function rollupRowForKpi(row: any, primaryKpi: string): WindowSnapshot {
  if (!row) return { spend: 0, results: 0, kpiValue: null };
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const cpa = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const spend = Number(row.spend || 0);
  const leads = sumActions(actions, LEAD_ACTION_TYPES);
  const purchases = sumActions(actions, PURCHASE_ACTION_TYPES);
  const videoViews = sumActions(actions, VIDEO_VIEW_ACTION_TYPES);

  const cplValue = firstCpa(cpa, LEAD_ACTION_TYPES) ?? (leads > 0 ? spend / leads : null);
  const cppValue = firstCpa(cpa, PURCHASE_ACTION_TYPES) ?? (purchases > 0 ? spend / purchases : null);
  const costPerThruPlay = firstCpa(cpa, VIDEO_VIEW_ACTION_TYPES) ?? (videoViews > 0 ? spend / videoViews : null);
  const purchaseRoas = Array.isArray(row.purchase_roas) && row.purchase_roas.length
    ? Number(row.purchase_roas[0]?.value || 0) || null : null;

  let kpiValue: number | null = null;
  let results = 0;
  switch (primaryKpi) {
    case 'cpl': kpiValue = cplValue; results = leads; break;
    case 'cpp': kpiValue = cppValue; results = purchases; break;
    case 'cpc': kpiValue = numberish(row.cpc); results = Number(row.clicks || 0); break;
    case 'cpm': kpiValue = numberish(row.cpm); results = Number(row.impressions || 0); break;
    case 'ctr': kpiValue = numberish(row.ctr); results = Number(row.clicks || 0); break;
    case 'roas': kpiValue = purchaseRoas; results = purchases; break;
    case 'costPerThruPlay': kpiValue = costPerThruPlay; results = videoViews; break;
    default: kpiValue = cplValue; results = leads;
  }

  return {
    spend, results, kpiValue,
    date_start: row.date_start, date_stop: row.date_stop,
  };
}

// ---------------------------------------------------------------------------
// Adset / audience detection
// ---------------------------------------------------------------------------

function detectAdsetType(name?: string | null): 'testing' | 'scaling' | 'unknown' {
  if (!name) return 'unknown';
  const n = name.toLowerCase();
  if (/(scaling|scale|scaler|winners|winner)/.test(n)) return 'scaling';
  if (/(testing|test|launcher|new)/.test(n)) return 'testing';
  return 'unknown';
}

function detectAudienceTemp(name?: string | null, targeting?: any): 'cold' | 'warm' | 'unknown' {
  if (name) {
    const n = name.toLowerCase();
    if (/(retarget|warm|remarket|website|engaged|ig\s*engager|fb\s*engager|customer)/.test(n)) return 'warm';
    if (/(cold|prospect|broad|interest|lookalike|lal|new)/.test(n)) return 'cold';
  }
  // Fallback: inspect targeting custom_audiences for non-lookalike entries.
  if (targeting?.custom_audiences && Array.isArray(targeting.custom_audiences) && targeting.custom_audiences.length > 0) {
    return 'warm';
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Classification — the heart of the engine. Implements every rule in §6.
// ---------------------------------------------------------------------------

interface ClassifyArgs {
  id: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  primaryKpi: string;
  primaryGoal: number;
  primaryDirection: 'less_than' | 'greater_than';
  secondaryKpi: string | null;
  meta3: any; meta7: any; meta30: any; metaFatigueRef: any;
  adsetType: 'testing' | 'scaling' | 'unknown';
  audienceTemp: 'cold' | 'warm' | 'unknown';
  adsetDailyBudget: number;
  campaignType: 'ABO' | 'CBO';
  adInfo?: any;
}

function classify(args: ClassifyArgs): AdEvaluation {
  const w3 = rollupRowForKpi(args.meta3, args.primaryKpi);
  const w7 = rollupRowForKpi(args.meta7, args.primaryKpi);
  const w30 = rollupRowForKpi(args.meta30, args.primaryKpi);
  const wFatigueRef = rollupRowForKpi(args.metaFatigueRef, args.primaryKpi);

  // Pull reach + frequency from the LONG window — most stable.
  const reach = Number(args.meta30?.reach || 0);
  const frequency = Number(args.meta30?.frequency || 0);

  // Days live: prefer Meta's date_start on the ad, fall back to LONG window's date_start.
  const createdTime = args.adInfo?.created_time;
  const startMs = createdTime ? new Date(createdTime).getTime()
    : args.meta30?.date_start ? new Date(args.meta30.date_start).getTime()
    : null;
  const daysLive = startMs ? Math.max(0, Math.round((Date.now() - startMs) / (1000 * 60 * 60 * 24))) : 0;

  // Secondary KPI value — show purchases / ROAS regardless of primary, when applicable.
  let secondary: AdEvaluation['secondary'] = null;
  if (args.secondaryKpi === 'cpp') {
    const purchases = sumActions(args.meta30?.actions || [], PURCHASE_ACTION_TYPES);
    secondary = { value: purchases || 0, label: 'Purchases (lifetime)' };
  } else if (args.secondaryKpi === 'roas') {
    const r = Array.isArray(args.meta30?.purchase_roas) && args.meta30.purchase_roas.length
      ? Number(args.meta30.purchase_roas[0]?.value || 0) || null : null;
    secondary = { value: r, label: 'ROAS' };
  } else if (args.secondaryKpi === 'cvr_proxy') {
    secondary = { value: null, label: 'On-site conversion rate (set up pixel to see)' };
  }

  // -- Apply rules in priority order. First match wins.
  const result = applyRules({
    args, reach, frequency, daysLive,
    w3, w7, w30, wFatigueRef,
  });

  // vsGoalPct — using the medium window as the headline.
  const headlineKpi = w7.kpiValue;
  const vsGoalPct = headlineKpi != null && args.primaryGoal > 0
    ? ((headlineKpi - args.primaryGoal) / args.primaryGoal) * 100
    : null;

  // Trend direction across long → medium → short (whether KPI is improving).
  const trendDirection = computeTrend(args.primaryDirection, w30.kpiValue, w7.kpiValue, w3.kpiValue);

  return {
    id: args.id, name: args.name, level: args.level,
    status: result.status,
    primary: { value: w7.kpiValue, vsGoalPct, trendDirection },
    secondary,
    reach, daysLive,
    windows: { short: w3, medium: w7, long: w30 },
    recommendation: result.recommendation,
  };
}

function computeTrend(
  direction: 'less_than' | 'greater_than',
  long: number | null, medium: number | null, short: number | null,
): 'up' | 'down' | 'flat' {
  if (long == null || medium == null || short == null) return 'flat';
  // For "less_than" KPIs (CPL, CPP, etc.), DOWN over time = improving (good direction).
  // For "greater_than" KPIs (ROAS, CTR), UP over time = improving.
  const movingDown = short < medium && medium < long;
  const movingUp = short > medium && medium > long;
  if (direction === 'less_than') {
    if (movingDown) return 'down';   // CPL going down = good
    if (movingUp) return 'up';       // CPL going up = bad
    return 'flat';
  } else {
    if (movingUp) return 'up';
    if (movingDown) return 'down';
    return 'flat';
  }
}

// ---------------------------------------------------------------------------
// Rule application — order matters. First match wins.
// ---------------------------------------------------------------------------

interface RuleArgs {
  args: ClassifyArgs;
  reach: number; frequency: number; daysLive: number;
  w3: WindowSnapshot; w7: WindowSnapshot; w30: WindowSnapshot; wFatigueRef: WindowSnapshot;
}

function applyRules(r: RuleArgs): { status: Status; recommendation: AdEvaluation['recommendation'] } {
  const { args, reach, frequency, daysLive, w3, w7, w30, wFatigueRef } = r;

  // §6.7 — Learning. Fail-fast for thin data.
  if (reach < 1000 || daysLive < 7) {
    return {
      status: 'learning',
      recommendation: {
        action: 'wait',
        reasoning: reach < 1000
          ? "Not enough reach yet to make a confident call — Meta's still finding the audience. Check back when reach passes 1,000."
          : `Only ${daysLive} day${daysLive === 1 ? '' : 's'} live — Meta typically needs 7+ days to optimize. Check back at the 7-day mark.`,
        confidence: 'high',
        impact: 0,
        impactReasoning: 'No action — gathering data.',
        priorityTier: 5,
      },
    };
  }

  // §6.5 — Spend-starved (campaigns / adsets only — ad-level spend allocation isn't user-controlled).
  if (args.level !== 'ad' && args.adsetDailyBudget > 0) {
    const avgDailySpend3d = w3.spend / Math.max(1, 3);
    if (avgDailySpend3d < args.adsetDailyBudget * 0.85) {
      const pct = Math.round((avgDailySpend3d / args.adsetDailyBudget) * 100);
      return {
        status: 'spend_starved',
        recommendation: {
          action: 'push_delivery',
          reasoning: `Meta hasn't been spending the full daily budget — averaging ${pct}% of $${args.adsetDailyBudget.toFixed(0)} across the last 3 days. Usually means audience is too narrow, the creative isn't winning the auction, or you've added new creative that Meta hasn't picked up. Try Meta's "push delivery" feature on your highest-CTR creative for 7 days, broaden the audience, or lower the budget if you're satisfied at the current pace.`,
          confidence: 'high',
          impact: estimateImpact('spend_starved', { dailyBudget: args.adsetDailyBudget, avgDailySpend: avgDailySpend3d }),
          impactReasoning: `~$${((args.adsetDailyBudget - avgDailySpend3d) * 7).toFixed(0)} of allocated budget went unspent last week`,
          priorityTier: 1,
        },
      };
    }
  }

  // §6.1 — Underperformer. Both 3-day and 7-day need to be > goal × 1.5.
  const isWorseThan = (val: number | null, threshold: number) => {
    if (val == null) return false;
    return args.primaryDirection === 'less_than' ? val > threshold : val < threshold;
  };
  const goalMultiplier = (m: number) =>
    args.primaryDirection === 'less_than' ? args.primaryGoal * m : args.primaryGoal / m;

  if (isWorseThan(w3.kpiValue, goalMultiplier(1.5)) && isWorseThan(w7.kpiValue, goalMultiplier(1.5))) {
    return {
      status: 'underperforming',
      recommendation: {
        action: 'turn_off',
        reasoning: `Cost is consistently above your target across both 3-day and 7-day windows (${formatKpiValue(w7.kpiValue, args.primaryKpi)} vs target ${formatKpiValue(args.primaryGoal, args.primaryKpi)}). Worth turning off and replacing.`,
        confidence: w7.results >= 30 && w3.results >= 30 ? 'high' : 'medium',
        impact: estimateImpact('turn_off', { weeklySpend: w7.spend }),
        impactReasoning: `~$${(w7.spend).toFixed(0)} per week saved if you turn this off`,
        priorityTier: 2,
      },
    };
  }

  // §6.4 — Fatigue. CPL up 30%+ vs prior 14d AND frequency over the temp threshold.
  const freqThreshold = args.audienceTemp === 'warm' ? 5 : 3;
  if (w7.kpiValue != null && wFatigueRef.kpiValue != null && wFatigueRef.kpiValue > 0) {
    const fatiguePct = ((w7.kpiValue - wFatigueRef.kpiValue) / wFatigueRef.kpiValue) * 100;
    const isFatigueDir = args.primaryDirection === 'less_than' ? fatiguePct >= 30 : fatiguePct <= -30;
    if (isFatigueDir && frequency > freqThreshold) {
      return {
        status: 'fatigued',
        recommendation: {
          action: 'refresh_creative',
          reasoning: `${args.primaryKpi.toUpperCase()} has crept up ${Math.abs(fatiguePct).toFixed(0)}% over the last week vs. the week before. Frequency is ${frequency.toFixed(1)}, meaning the same people are seeing this ad repeatedly. Time for fresh creative.`,
          confidence: 'high',
          impact: estimateImpact('refresh', { weeklySpend: w7.spend }),
          impactReasoning: `${Math.abs(fatiguePct).toFixed(0)}% efficiency drop and rising frequency — replace before it gets worse`,
          priorityTier: 3,
        },
      };
    }
  }

  // §6.2 — Scaling-ready (testing adset only).
  const isBetterOrEq = (val: number | null, threshold: number) => {
    if (val == null) return false;
    return args.primaryDirection === 'less_than' ? val <= threshold : val >= threshold;
  };
  if (
    args.level !== 'campaign' &&
    daysLive >= 5 &&
    isBetterOrEq(w3.kpiValue, goalMultiplier(0.9)) &&
    isBetterOrEq(w7.kpiValue, goalMultiplier(0.9))
  ) {
    if (args.adsetType === 'testing' && args.campaignType === 'ABO') {
      return {
        status: 'scaling_ready',
        recommendation: {
          action: 'promote_to_scaling',
          reasoning: `Hitting goal consistently in testing (${formatKpiValue(w7.kpiValue, args.primaryKpi)} vs target ${formatKpiValue(args.primaryGoal, args.primaryKpi)}). Duplicate to scaling adset and turn off here. Heads-up: scaling adset will reset Meta's learning, expect a few days of recalibration before performance settles.`,
          confidence: w7.results >= 30 ? 'high' : 'medium',
          impact: estimateImpact('scale_up', { weeklySpend: w7.spend, kpiValue: w7.kpiValue, goal: args.primaryGoal }),
          impactReasoning: `Beating goal consistently — promoting to scaling unlocks more spend at this efficiency`,
          priorityTier: 4,
        },
      };
    } else if (args.campaignType === 'CBO') {
      return {
        status: 'scaling_ready',
        recommendation: {
          action: 'add_similar_variants',
          reasoning: `Hitting goal consistently. Meta is favoring this creative — add 2-3 similar-style variants to give the algorithm more options that match what's working.`,
          confidence: w7.results >= 30 ? 'high' : 'medium',
          impact: estimateImpact('scale_up', { weeklySpend: w7.spend, kpiValue: w7.kpiValue, goal: args.primaryGoal }),
          impactReasoning: `Beating goal — more variants gives Meta more headroom to spend`,
          priorityTier: 4,
        },
      };
    }
  }

  // §6.3 — Performing in scaling.
  if (
    args.adsetType === 'scaling' &&
    isBetterOrEq(w3.kpiValue, args.primaryGoal) &&
    isBetterOrEq(w7.kpiValue, args.primaryGoal)
  ) {
    return {
      status: 'performing',
      recommendation: {
        action: 'hold',
        reasoning: 'Doing what you wanted it to. Hold steady.',
        confidence: 'high', impact: 0, impactReasoning: 'No action — performing as expected.',
        priorityTier: 5,
      },
    };
  }

  // §6.6 — Promising. KPI improving across windows but still above goal.
  const trend = computeTrend(args.primaryDirection, w30.kpiValue, w7.kpiValue, w3.kpiValue);
  if (
    trend === 'down' && args.primaryDirection === 'less_than'
    || trend === 'up' && args.primaryDirection === 'greater_than'
  ) {
    if (isWorseThan(w3.kpiValue, args.primaryGoal)) {
      return {
        status: 'promising',
        recommendation: {
          action: 'hold',
          reasoning: `${args.primaryKpi.toUpperCase()} is above goal but trending the right direction across 3-day, 7-day, and 30-day windows. Give it 3-5 more days of spend before deciding.`,
          confidence: 'medium', impact: 0,
          impactReasoning: 'Patience pays — early kills miss winners',
          priorityTier: 5,
        },
      };
    }
  }

  // Default: holding pattern. Not exceptional in either direction.
  return {
    status: 'performing',
    recommendation: {
      action: 'hold',
      reasoning: `${args.primaryKpi.toUpperCase()} is around your target. Hold and watch.`,
      confidence: 'medium', impact: 0,
      impactReasoning: 'No action — at goal.',
      priorityTier: 5,
    },
  };
}

function estimateImpact(kind: string, ctx: any): number {
  // 0-100 score. Used for picking topRecommendation within a tier.
  switch (kind) {
    case 'turn_off':
      // Weekly spend saved.
      return Math.min(100, Math.round((ctx.weeklySpend || 0) / 5));
    case 'refresh':
      return Math.min(100, Math.round((ctx.weeklySpend || 0) / 5));
    case 'scale_up':
      // Efficiency margin × weekly spend, normalized.
      if (!ctx.kpiValue || !ctx.goal) return 30;
      const margin = Math.abs(1 - (ctx.kpiValue / ctx.goal));
      return Math.min(100, Math.round((ctx.weeklySpend || 0) * margin / 3));
    case 'spend_starved':
      // Weekly underspend.
      const weeklyGap = ((ctx.dailyBudget || 0) - (ctx.avgDailySpend || 0)) * 7;
      return Math.min(100, Math.round(weeklyGap / 5));
    default:
      return 0;
  }
}

function formatKpiValue(v: number | null, kpi: string): string {
  if (v == null) return '—';
  if (kpi === 'roas') return `${v.toFixed(2)}x`;
  if (kpi === 'ctr') return `${v.toFixed(2)}%`;
  return `$${v.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Top recommendation — playbook §7 tiered priority.
// ---------------------------------------------------------------------------

function pickTopRecommendation(all: AdEvaluation[]): AdEvaluation | null {
  // Tier 1 = highest priority (spend-starved). Lower is more urgent.
  // Within a tier, sort by impact × confidence factor.
  const confidenceWeight = (c: 'high' | 'medium' | 'low') =>
    c === 'high' ? 1 : c === 'medium' ? 0.7 : 0.4;

  const ranked = [...all]
    .filter(e => e.recommendation.priorityTier <= 4) // exclude no-priority (tier 5)
    .sort((a, b) => {
      if (a.recommendation.priorityTier !== b.recommendation.priorityTier) {
        return a.recommendation.priorityTier - b.recommendation.priorityTier;
      }
      const ai = a.recommendation.impact * confidenceWeight(a.recommendation.confidence);
      const bi = b.recommendation.impact * confidenceWeight(b.recommendation.confidence);
      return bi - ai;
    });

  return ranked[0] || null;
}

// Exported for tests only — do not use from production code.
export const __test_exports = {
  classify,
  applyRules,
  pickTopRecommendation,
  detectAdsetType,
  detectAudienceTemp,
  computeWindows,
  rollupRowForKpi,
};
