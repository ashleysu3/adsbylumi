import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// generate-campaign-retrospective (Patch #23 upgrade)
//
// Two entry paths:
//   1. { workspaceId } — original path. Pull workspace + brand, run retro.
//   2. { brandId, metaCampaignId } — new in patch #23. For Meta campaigns
//      that aren't LUMI workspaces yet (or the user just doesn't want to
//      open the workspace). We auto-find or auto-create a workspace stub
//      tagged with that meta_campaign_id, then run the regular flow.
//
// Patch #23 fix: previously read workspace.meta_campaign_id (column doesn't
// exist) — corrected to workspace.meta_campaign_ids?.campaignId, which is
// the JSONB shape the rest of the codebase uses.
// ============================================================================

interface RetrospectiveJSON {
  summary: string;
  stats: {
    total_spend: number;
    total_results: number;
    avg_cpl: number | null;
    duration_days: number | null;
    objective: string | null;
  };
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

    // Resolve to a workspace, creating a stub if the caller passed
    // (brandId + metaCampaignId) instead of workspaceId.
    let workspaceId: string | null = body?.workspaceId ?? null;

    if (!workspaceId && body?.metaCampaignId && body?.brandId) {
      // Ownership check on the brand.
      const { data: ownerCheck } = await sb
        .from('brands')
        .select('id, user_id')
        .eq('id', body.brandId)
        .single();
      if (!ownerCheck || ownerCheck.user_id !== user.id) {
        return json({ error: 'Forbidden' }, 403);
      }

      // Find an existing workspace for that meta campaign on that brand.
      const { data: existingWs } = await sb
        .from('campaign_workspaces')
        .select('id, meta_campaign_ids')
        .eq('brand_id', body.brandId);
      const found = (existingWs || []).find(
        (w: any) => w?.meta_campaign_ids?.campaignId === body.metaCampaignId,
      );
      if (found) {
        workspaceId = found.id;
      } else {
        // Look up the campaign's name from Meta to seed a sensible workspace name.
        let metaName = 'Imported campaign';
        try {
          const { data: brand } = await sb
            .from('brands')
            .select('meta_access_token')
            .eq('id', body.brandId)
            .single();
          if (brand?.meta_access_token) {
            const r = await fetch(
              `https://graph.facebook.com/v21.0/${body.metaCampaignId}?fields=name,objective&access_token=${brand.meta_access_token}`,
            );
            const d = await r.json();
            if (r.ok && d?.name) metaName = d.name;
          }
        } catch (_) { /* non-fatal */ }

        const { data: created, error: createErr } = await sb
          .from('campaign_workspaces')
          .insert({
            brand_id: body.brandId,
            name: metaName,
            offer_name: metaName,
            meta_campaign_ids: { campaignId: body.metaCampaignId },
            archived: true,
            archived_at: new Date().toISOString(),
          })
          .select('id')
          .single();
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

    // Fetch workspace + ownership check via brand.
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

    // Patch #23 fix: read meta_campaign_ids JSONB shape, not the
    // (nonexistent) meta_campaign_id column.
    const metaCampaignId =
      (workspace.meta_campaign_ids as any)?.campaignId || null;

    const performance = metaCampaignId && brand.meta_access_token
      ? await fetchCampaignPerformance(metaCampaignId, brand.meta_access_token)
      : null;

    const startedAt = workspace.created_at ? new Date(workspace.created_at) : null;
    const endedAt = workspace.archived_at ? new Date(workspace.archived_at) : new Date();
    const durationDays = startedAt
      ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const prompt = buildPrompt({
      brandName: brand.name,
      offerName: workspace.offer_name || workspace.name || 'Unnamed campaign',
      durationDays,
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
              'You are an expert Meta ads strategist running a post-mortem on a completed campaign. Be specific, honest, and grounded in the data. Return ONLY valid JSON matching the schema in the user prompt — no prose, no code fences.',
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
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
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
      },
      wins: normalizeBullets(parsed.wins),
      misses: normalizeBullets(parsed.misses),
      recommendations: normalizeBullets(parsed.recommendations),
      generated_at: new Date().toISOString(),
    };

    await sb
      .from('campaign_workspaces')
      .update({
        retrospective_json: retrospective,
        retrospective_generated_at: retrospective.generated_at,
      })
      .eq('id', workspaceId);

    await sb
      .from('brand_learnings')
      .update({ is_active: false })
      .eq('source_workspace_id', workspaceId);

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

    return json({ success: true, retrospective, workspaceId });
  } catch (err: any) {
    console.error('generate-campaign-retrospective error:', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    confidence:
      item?.confidence === 'high' || item?.confidence === 'low' ? item.confidence : 'medium',
  })).filter(x => x.insight.length > 0);
}

async function fetchCampaignPerformance(metaCampaignId: string, accessToken: string) {
  const fields = [
    'campaign_id', 'campaign_name',
    'spend', 'impressions', 'clicks',
    'ctr', 'cpc', 'cpm',
    'actions', 'cost_per_action_type',
    'objective',
    'date_start', 'date_stop',
  ].join(',');

  // Helper that tries lifetime first, then falls back to an explicit
  // 3-year time_range. Meta's insights endpoint sometimes returns an empty
  // data array for date_preset=lifetime on archived/old campaigns; an
  // explicit time_range covers those cases.
  const fetchInsights = async (level: 'campaign' | 'adset' | 'ad', extraFields = '') => {
    const f = extraFields ? `${fields},${extraFields}` : fields;
    const base = `https://graph.facebook.com/v21.0/${metaCampaignId}/insights?fields=${f}&level=${level}&access_token=${accessToken}`;
    try {
      const r1 = await fetch(`${base}&date_preset=maximum`);
      const d1 = await r1.json();
      if (!r1.ok) {
        console.error(`Meta insights ${level} error:`, r1.status, JSON.stringify(d1?.error || d1).slice(0, 300));
      }
      if (Array.isArray(d1?.data) && d1.data.length > 0) return d1.data;

      // Fallback: explicit wide time_range (Meta typically retains 37 months)
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const tr = encodeURIComponent(JSON.stringify({ since, until: today }));
      const r2 = await fetch(`${base}&time_range=${tr}`);
      const d2 = await r2.json();
      if (!r2.ok) {
        console.error(`Meta insights ${level} fallback error:`, r2.status, JSON.stringify(d2?.error || d2).slice(0, 300));
      }
      return Array.isArray(d2?.data) ? d2.data : [];
    } catch (e) {
      console.error(`Meta insights ${level} fetch threw:`, e);
      return [];
    }
  };

  try {
    // Always fetch the campaign metadata directly so we have name/objective
    // even when insights are empty (campaign never delivered).
    let campaignMeta: any = null;
    try {
      const mr = await fetch(
        `https://graph.facebook.com/v21.0/${metaCampaignId}?fields=name,objective,status,effective_status,created_time,start_time,stop_time&access_token=${accessToken}`,
      );
      const md = await mr.json();
      if (mr.ok) campaignMeta = md;
      else console.error('Meta campaign meta error:', mr.status, JSON.stringify(md?.error || md).slice(0, 300));
    } catch (e) {
      console.error('Meta campaign meta fetch threw:', e);
    }

    const [campaignRows, adsetRows, adRows] = await Promise.all([
      fetchInsights('campaign'),
      fetchInsights('adset', 'adset_id,adset_name'),
      fetchInsights('ad', 'ad_id,ad_name,adset_id'),
    ]);

    console.log('Meta insights row counts:', {
      campaign: campaignRows.length,
      adset: adsetRows.length,
      ad: adRows.length,
      hasMeta: !!campaignMeta,
      objective: campaignMeta?.objective,
    });

    const objective = campaignRows[0]?.objective || campaignMeta?.objective || null;
    const c = campaignRows[0];
    const totals = c
      ? {
          spend: Number(c.spend || 0),
          impressions: Number(c.impressions || 0),
          clicks: Number(c.clicks || 0),
          ctr: Number(c.ctr || 0),
          cpc: Number(c.cpc || 0),
          results: extractResultCount(c, objective),
          cpl: extractCostPerResult(c, objective),
          objective,
          result_kind: resultTypeForObjective(objective).kind,
          result_label: resultTypeForObjective(objective).label,
          cost_label: resultTypeForObjective(objective).cost_label,
          status: campaignMeta?.effective_status || campaignMeta?.status || null,
          campaign_name: c.campaign_name || campaignMeta?.name || null,
        }
      : campaignMeta
        ? {
            spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0,
            results: 0, cpl: null,
            objective,
            result_kind: resultTypeForObjective(objective).kind,
            result_label: resultTypeForObjective(objective).label,
            cost_label: resultTypeForObjective(objective).cost_label,
            status: campaignMeta.effective_status || campaignMeta.status || null,
            campaign_name: campaignMeta.name || null,
          }
        : null;

    return {
      totals,
      adsets: adsetRows,
      ads: adRows,
      meta: campaignMeta,
    };
  } catch (err) {
    console.error('Meta API fetch failed:', err);
    return null;
  }
}

// Maps a Meta objective to the result type that should be the campaign's
// primary KPI. Lead campaigns track leads/CPL, sales campaigns track
// purchases/CPP, traffic campaigns track link clicks/CPC, etc.
function resultTypeForObjective(objective: string | null | undefined): {
  kind: 'leads' | 'purchases' | 'link_clicks' | 'engagement' | 'video_views' | 'reach' | 'clicks';
  label: string;
  cost_label: string;
  action_priority: string[];
} {
  const o = String(objective || '').toUpperCase();
  if (o.includes('LEAD')) {
    return {
      kind: 'leads',
      label: 'Leads',
      cost_label: 'Cost per Lead (CPL)',
      action_priority: ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'leadgen.other', 'complete_registration', 'offsite_conversion.fb_pixel_complete_registration'],
    };
  }
  if (o.includes('SALES') || o.includes('CONVERSION') || o.includes('PURCHASE') || o.includes('CATALOG')) {
    return {
      kind: 'purchases',
      label: 'Purchases',
      cost_label: 'Cost per Purchase (CPP)',
      action_priority: ['purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase', 'omni_purchase'],
    };
  }
  if (o.includes('TRAFFIC') || o.includes('LINK_CLICKS')) {
    return {
      kind: 'link_clicks',
      label: 'Link Clicks',
      cost_label: 'Cost per Link Click (CPC)',
      action_priority: ['link_click'],
    };
  }
  if (o.includes('ENGAGEMENT') || o.includes('POST_ENGAGEMENT') || o.includes('MESSAGES')) {
    return {
      kind: 'engagement',
      label: 'Engagements',
      cost_label: 'Cost per Engagement',
      action_priority: ['post_engagement', 'page_engagement', 'onsite_conversion.messaging_conversation_started_7d'],
    };
  }
  if (o.includes('VIDEO')) {
    return {
      kind: 'video_views',
      label: 'Video Views (ThruPlay)',
      cost_label: 'Cost per ThruPlay',
      action_priority: ['video_view', 'video_thruplay_watched_actions'],
    };
  }
  if (o.includes('AWARENESS') || o.includes('REACH') || o.includes('BRAND')) {
    return {
      kind: 'reach',
      label: 'Reach',
      cost_label: 'CPM',
      action_priority: [],
    };
  }
  return {
    kind: 'clicks',
    label: 'Results',
    cost_label: 'Cost per Result',
    action_priority: ['purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'offsite_conversion.fb_pixel_lead', 'complete_registration', 'link_click'],
  };
}

function extractResultCount(insight: any, objective?: string | null): number {
  const cfg = resultTypeForObjective(objective);
  if (cfg.kind === 'reach') return Number(insight?.reach || insight?.impressions || 0);
  const actions = insight?.actions;
  if (Array.isArray(actions)) {
    for (const t of cfg.action_priority) {
      const m = actions.find((a: any) => a.action_type === t);
      if (m) return Number(m.value || 0);
    }
  }
  if (!objective) return Number(insight?.clicks || 0);
  return 0;
}

function extractCostPerResult(insight: any, objective?: string | null): number | null {
  const cfg = resultTypeForObjective(objective);
  if (cfg.kind === 'reach') {
    const cpm = Number(insight?.cpm);
    return isFinite(cpm) && cpm > 0 ? cpm : null;
  }
  const cpa = insight?.cost_per_action_type;
  if (Array.isArray(cpa)) {
    for (const t of cfg.action_priority) {
      const m = cpa.find((a: any) => a.action_type === t);
      if (m && m.value) return Number(m.value);
    }
  }
  const results = extractResultCount(insight, objective);
  const spend = Number(insight?.spend || 0);
  if (results > 0 && spend > 0) return spend / results;
  return null;
}

function buildPrompt(args: {
  brandName: string;
  offerName: string;
  durationDays: number | null;
  strategy: any;
  creative: any;
  productionItems: any;
  performance: any;
  isImported: boolean;
}): string {
  const objective = args.performance?.totals?.objective || args.strategy?.objective || null;
  const cfg = resultTypeForObjective(objective);

  const summary = {
    brand: args.brandName,
    offer: args.offerName,
    duration_days: args.durationDays,
    note: args.isImported
      ? 'This campaign was imported from Meta — LUMI does not have its angle/copy metadata. Base your post-mortem entirely on the Meta performance data.'
      : null,
    meta_objective: objective,
    primary_kpi: cfg.label,
    primary_cost_kpi: cfg.cost_label,
    strategy_objective: args.strategy?.objective || 'unknown',
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
      name: a.adset_name,
      spend: Number(a.spend || 0),
      results: extractResultCount(a, objective),
      cost_per_result: extractCostPerResult(a, objective),
      ctr: Number(a.ctr || 0),
    })),
    ad_breakdown: (args.performance?.ads || []).slice(0, 20).map((a: any) => ({
      name: a.ad_name,
      adset: a.adset_id,
      spend: Number(a.spend || 0),
      results: extractResultCount(a, objective),
      cost_per_result: extractCostPerResult(a, objective),
      ctr: Number(a.ctr || 0),
    })),
  };

  return `Run a post-mortem on this Meta ads campaign. Identify what worked, what didn't, and what to do differently next time.

Campaign data:
${JSON.stringify(summary, null, 2)}

Return a JSON object with this exact shape (no prose, no code fences):

{
  "summary": "One or two sentences — the headline takeaway.",
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

Critical KPI rules:
- This campaign's Meta objective is "${objective || 'unknown'}". The primary KPI is ${cfg.label} and ${cfg.cost_label}.
- "total_results" MUST be the count of ${cfg.label} (NOT clicks, NOT impressions, unless the objective is link clicks/awareness).
- "avg_cpl" MUST be the ${cfg.cost_label} value. If the campaign has no ${cfg.label}, set total_results to 0 and avg_cpl to null — do NOT substitute clicks or CPC.
- All wins/misses/recommendations should be evaluated against ${cfg.label} and ${cfg.cost_label}, not generic clicks.

Guidance:
- Aim for 2-3 wins, 2-3 misses, 4-5 recommendations. More if the data clearly supports more; never invent insights.
- Recommendations should be specific and actionable for the NEXT campaign — e.g. "Lead with curiosity-style hooks; testimonial format averaged 3x higher ${cfg.cost_label}." Avoid generic advice.
- Use confidence "high" only when the data clearly supports the claim. Use "medium" by default. Use "low" when you're guessing because the dataset is thin.
- If performance data is missing or zero (campaign was never published), focus on what the creative + strategy reveal, and set confidence appropriately.
- For imported (non-LUMI) campaigns, lean on adset/ad name patterns + spend curves — those are your only signals.
- Cite specific ad names, adset names, or angle names where possible.

Return ONLY the JSON object.`;
}
