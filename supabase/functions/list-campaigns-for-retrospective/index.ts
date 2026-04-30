import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// list-campaigns-for-retrospective (Patch #23)
//
// Powers the "Create retrospective" tray on the Retrospectives page. Pulls
// every Meta campaign on the brand's ad account that had spend > 0 in the
// requested time range, returns it with key performance numbers + a flag
// indicating whether LUMI already has a workspace + retrospective for it.
//
// Inputs:  { brandId, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD) }
// Returns: {
//   success: true,
//   campaigns: [{ metaCampaignId, name, status, objective, spend, results,
//                 cpl, hasWorkspace, workspaceId, hasRetrospective }]
// }
// ============================================================================

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

    const { brandId, startDate, endDate } = await req.json();
    if (!brandId || !startDate || !endDate) {
      return json({ error: 'brandId, startDate, endDate are required' }, 400);
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Brand ownership check + grab Meta credentials.
    const { data: brand, error: bErr } = await sb
      .from('brands')
      .select('id, user_id, meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();
    if (bErr || !brand) return json({ error: 'Brand not found' }, 404);
    if (brand.user_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (!brand.meta_account_id || !brand.meta_access_token) {
      return json({ error: 'This brand is not connected to Meta yet' }, 400);
    }

    // Pull insights at the campaign level for the requested time range,
    // filtered to campaigns with spend > 0. Single round-trip.
    const fields = ['campaign_id', 'campaign_name', 'spend', 'actions', 'cost_per_action_type', 'objective'].join(',');
    const insightsUrl =
      `https://graph.facebook.com/v21.0/${brand.meta_account_id}/insights` +
      `?level=campaign` +
      `&time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}` +
      `&fields=${fields}` +
      `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'spend', operator: 'GREATER_THAN', value: '0' }]))}` +
      `&limit=200&access_token=${brand.meta_access_token}`;

    const insRes = await fetch(insightsUrl);
    const insData = await insRes.json();
    if (!insRes.ok) {
      console.error('Meta insights fetch failed:', insData);
      return json(
        { error: insData?.error?.message || 'Failed to load campaigns from Meta' },
        502,
      );
    }
    const insightsArr: any[] = Array.isArray(insData?.data) ? insData.data : [];

    // Pull campaign metadata (status) for the same campaigns. Insights
    // doesn't give us status; one extra call.
    const ids = insightsArr.map(i => i.campaign_id).filter(Boolean);
    let statusMap: Record<string, string> = {};
    if (ids.length > 0) {
      const idsParam = encodeURIComponent(JSON.stringify({ filtering: [{ field: 'id', operator: 'IN', value: ids }] }));
      // The Graph API doesn't accept filtering on the /campaigns edge cleanly via JSON param,
      // so we just fetch all campaigns and intersect locally.
      const campsRes = await fetch(
        `https://graph.facebook.com/v21.0/${brand.meta_account_id}/campaigns?fields=id,status&limit=500&access_token=${brand.meta_access_token}`,
      );
      const campsData = await campsRes.json();
      if (campsRes.ok && Array.isArray(campsData?.data)) {
        for (const c of campsData.data) {
          if (c?.id) statusMap[c.id] = c.status || 'UNKNOWN';
        }
      }
    }

    // Cross-reference with our campaign_workspaces table to flag which
    // already have a LUMI workspace + retrospective for this user's brand.
    const { data: existingWorkspaces } = await sb
      .from('campaign_workspaces')
      .select('id, meta_campaign_ids, retrospective_json')
      .eq('brand_id', brandId);
    const wsByMetaId = new Map<string, { workspaceId: string; hasRetrospective: boolean }>();
    (existingWorkspaces || []).forEach((w: any) => {
      const mid = w?.meta_campaign_ids?.campaignId;
      if (mid && typeof mid === 'string') {
        wsByMetaId.set(mid, {
          workspaceId: w.id,
          hasRetrospective: !!w.retrospective_json,
        });
      }
    });

    const campaigns = insightsArr.map(i => {
      const spend = Number(i.spend || 0);
      const results = extractResultCount(i);
      const cpl = extractCostPerResult(i);
      const ref = wsByMetaId.get(i.campaign_id);
      return {
        metaCampaignId: i.campaign_id,
        name: i.campaign_name || 'Unnamed',
        status: statusMap[i.campaign_id] || 'UNKNOWN',
        objective: i.objective || null,
        spend,
        results,
        cpl,
        hasWorkspace: !!ref,
        workspaceId: ref?.workspaceId || null,
        hasRetrospective: ref?.hasRetrospective || false,
      };
    });

    // Sort by spend desc — biggest campaigns first, since those are most
    // likely the ones the user wants to retro.
    campaigns.sort((a, b) => b.spend - a.spend);

    return json({ success: true, campaigns });
  } catch (err: any) {
    console.error('list-campaigns-for-retrospective error:', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractResultCount(insight: any): number {
  const actions = insight?.actions;
  if (!Array.isArray(actions)) return 0;
  const priority = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'offsite_conversion.fb_pixel_lead', 'complete_registration'];
  for (const t of priority) {
    const m = actions.find((a: any) => a.action_type === t);
    if (m) return Number(m.value || 0);
  }
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
