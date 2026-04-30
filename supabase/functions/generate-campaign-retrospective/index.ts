import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// generate-campaign-retrospective (Patch #20)
//
// Pulls Meta performance data + LUMI's creative metadata for a single
// campaign workspace, sends it to Gemini 2.5 Flash with a structured
// post-mortem prompt, and saves the result back to the workspace row +
// brand_learnings table.
//
// Inputs:  { workspaceId }
// Returns: { success: true, retrospective: {...} }
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
      return json({ error: 'Unauthorized' }, 200);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 200);

    const { workspaceId } = await req.json();
    if (!workspaceId) return json({ error: 'workspaceId is required' }, 200);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch workspace + ownership check via brand.
    const { data: workspace, error: wErr } = await sb
      .from('campaign_workspaces')
      .select('id, brand_id, name, offer_name, creative_json, production_items, strategy_json, archived_at, created_at, meta_campaign_ids')
      .eq('id', workspaceId)
      .maybeSingle();
    if (wErr) return json({ error: `Workspace lookup failed: ${wErr.message}` }, 200);
    if (!workspace) return json({ error: `Workspace not found for id ${workspaceId}` }, 200);

    const { data: brand, error: bErr } = await sb
      .from('brands')
      .select('id, user_id, name, meta_account_id, meta_access_token')
      .eq('id', workspace.brand_id)
      .maybeSingle();
    if (bErr) return json({ error: `Brand lookup failed: ${bErr.message}` }, 200);
    if (!brand) return json({ error: 'Brand not found' }, 200);
    if (brand.user_id !== user.id) return json({ error: 'Forbidden' }, 200);

    // Pull Meta campaign performance. If the workspace doesn't have a
    // meta_campaign_id (campaign was never published) we still produce a
    // retrospective from creative_json alone — useful for "what would've
    // worked" reflection on drafts.
    const performance = workspace.meta_campaign_id && brand.meta_access_token
      ? await fetchCampaignPerformance(workspace.meta_campaign_id, brand.meta_access_token)
      : null;

    // Build the AI input.
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
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return json({ error: 'LOVABLE_API_KEY not configured' }, 200);
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
      return json({ error: `AI analysis failed (${aiRes.status})` }, 200);
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
      return json({ error: 'AI returned unparseable output. Try again.' }, 200);
    }

    const retrospective: RetrospectiveJSON = {
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 600) : '',
      stats: {
        total_spend: numberOr(parsed?.stats?.total_spend, performance?.totals?.spend ?? 0),
        total_results: Math.round(numberOr(parsed?.stats?.total_results, performance?.totals?.results ?? 0)),
        avg_cpl: parsed?.stats?.avg_cpl != null ? numberOr(parsed.stats.avg_cpl, null) : performance?.totals?.cpl ?? null,
        duration_days: durationDays,
        objective: workspace.strategy_json?.objective || null,
      },
      wins: normalizeBullets(parsed.wins),
      misses: normalizeBullets(parsed.misses),
      recommendations: normalizeBullets(parsed.recommendations),
      generated_at: new Date().toISOString(),
    };

    // Save the cached JSON onto the workspace.
    await sb
      .from('campaign_workspaces')
      .update({
        retrospective_json: retrospective,
        retrospective_generated_at: retrospective.generated_at,
      })
      .eq('id', workspaceId);

    // Deactivate any prior learnings extracted from THIS workspace (we're
    // regenerating the post-mortem) and insert the fresh ones. This keeps
    // brand_learnings clean even if the user re-runs the retro multiple
    // times on the same campaign.
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
      if (insErr) {
        console.error('brand_learnings insert failed (non-fatal):', insErr);
      }
    }

    return json({ success: true, retrospective });
  } catch (err: any) {
    console.error('generate-campaign-retrospective error:', err);
    return json({ error: err?.message || 'Unknown error' }, 200);
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

// ---------------------------------------------------------------------------
// Meta Marketing API helper
// ---------------------------------------------------------------------------

async function fetchCampaignPerformance(metaCampaignId: string, accessToken: string) {
  // Pull insights at the campaign + ad-set + ad level. Default time range
  // is "lifetime" since this is a retrospective.
  const fields = [
    'campaign_id', 'campaign_name',
    'spend', 'impressions', 'clicks',
    'ctr', 'cpc', 'cpm',
    'actions', 'cost_per_action_type',
    'objective',
    'date_start', 'date_stop',
  ].join(',');

  try {
    const campaignRes = await fetch(
      `https://graph.facebook.com/v18.0/${metaCampaignId}/insights?fields=${fields}&date_preset=lifetime&level=campaign&access_token=${accessToken}`,
    );
    const campaignData = await campaignRes.json();
    const adsetRes = await fetch(
      `https://graph.facebook.com/v18.0/${metaCampaignId}/insights?fields=${fields},adset_id,adset_name&date_preset=lifetime&level=adset&access_token=${accessToken}`,
    );
    const adsetData = await adsetRes.json();
    const adRes = await fetch(
      `https://graph.facebook.com/v18.0/${metaCampaignId}/insights?fields=${fields},ad_id,ad_name,adset_id&date_preset=lifetime&level=ad&access_token=${accessToken}`,
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
          // Pick lead/purchase/result counts from actions if available.
          results: extractResultCount(c),
          cpl: extractCostPerResult(c),
          objective: c.objective,
        }
      : null;

    return {
      totals,
      adsets: adsetData?.data || [],
      ads: adData?.data || [],
    };
  } catch (err) {
    console.error('Meta API fetch failed:', err);
    return null;
  }
}

function extractResultCount(insight: any): number {
  const actions = insight?.actions;
  if (!Array.isArray(actions)) return 0;
  // Prefer purchase, then lead, then registration / complete_registration.
  const priority = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'offsite_conversion.fb_pixel_lead', 'complete_registration'];
  for (const t of priority) {
    const m = actions.find((a: any) => a.action_type === t);
    if (m) return Number(m.value || 0);
  }
  // Fallback: clicks
  return Number(insight?.clicks || 0);
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
  strategy: any;
  creative: any;
  productionItems: any;
  performance: any;
}): string {
  const summary = {
    brand: args.brandName,
    offer: args.offerName,
    duration_days: args.durationDays,
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
      results: extractResultCount(a),
      cpl: extractCostPerResult(a),
    })),
    ad_breakdown: (args.performance?.ads || []).slice(0, 20).map((a: any) => ({
      name: a.ad_name,
      adset: a.adset_id,
      spend: Number(a.spend || 0),
      results: extractResultCount(a),
      cpl: extractCostPerResult(a),
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

Guidance:
- Aim for 2-3 wins, 2-3 misses, 4-5 recommendations. More if the data clearly supports more; never invent insights.
- Recommendations should be specific and actionable for the NEXT campaign — e.g. "Lead with curiosity-style hooks; testimonial format averaged 3x higher CPL." Avoid generic advice.
- Use confidence "high" only when the data clearly supports the claim. Use "medium" by default. Use "low" when you're guessing because the dataset is thin.
- If performance data is missing or zero (e.g. campaign was never published), focus on what the creative + strategy reveal, and set confidence appropriately.
- Cite specific ad names, adset names, or angle names where possible.

Return ONLY the JSON object.`;
}
