import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// list-campaigns-for-retrospective (Patch #25 — KPI-aware)
//
// Same bugfix as the retrospective: each row in the tray now reports
// performance using the campaign's CORRECT primary KPI (CPL for lead gen,
// CPP for sales, ROAS for conversions, etc.) — not the previous fall-
// through that always preferred purchase.
//
// Returns an additional `kpi` and `kpiLabel` per row so the UI can render
// "$4.20 / lead" or "2.4x ROAS" instead of a generic "$X / result."
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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { brandId, startDate, endDate } = await req.json();
    if (!brandId || !startDate || !endDate) {
      return json({ error: 'brandId, startDate, endDate are required' }, 400);
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: brand, error: bErr } = await sb
      .from('brands').select('id, user_id, meta_account_id, meta_access_token')
      .eq('id', brandId).single();
    if (bErr || !brand) return json({ error: 'Brand not found' }, 404);
    if (brand.user_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (!brand.meta_account_id || !brand.meta_access_token) {
      return json({ error: 'This brand is not connected to Meta yet' }, 400);
    }

    // Pull insights at the campaign level. We need actions / cost_per_action_type
    // / purchase_roas to compute per-KPI numbers per row.
    const fields = [
      'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks',
      'ctr', 'cpc', 'cpm', 'actions', 'cost_per_action_type',
      'purchase_roas', 'objective',
    ].join(',');
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
      return json({ error: insData?.error?.message || 'Failed to load campaigns from Meta' }, 502);
    }
    const insightsArr: any[] = Array.isArray(insData?.data) ? insData.data : [];

    // Fetch campaign-list metadata (status) — insights doesn't include status.
    let statusMap: Record<string, string> = {};
    if (insightsArr.length > 0) {
      const campsRes = await fetch(
        `https://graph.facebook.com/v21.0/${brand.meta_account_id}/campaigns?fields=id,status,objective&limit=500&access_token=${brand.meta_access_token}`,
      );
      const campsData = await campsRes.json();
      if (campsRes.ok && Array.isArray(campsData?.data)) {
        for (const c of campsData.data) {
          if (c?.id) statusMap[c.id] = c.status || 'UNKNOWN';
        }
      }
    }

    // Cross-reference with our campaign_workspaces table.
    const { data: existingWorkspaces } = await sb
      .from('campaign_workspaces').select('id, meta_campaign_ids, retrospective_json')
      .eq('brand_id', brandId);
    const wsByMetaId = new Map<string, { workspaceId: string; hasRetrospective: boolean }>();
    (existingWorkspaces || []).forEach((w: any) => {
      const mid = w?.meta_campaign_ids?.campaignId;
      if (mid && typeof mid === 'string') {
        wsByMetaId.set(mid, { workspaceId: w.id, hasRetrospective: !!w.retrospective_json });
      }
    });

    const campaigns = insightsArr.map(i => {
      const objective = i.objective || null;
      const kpi = LUMI_KPI_FROM_OBJECTIVE[String(objective || '')] || 'cpl';
      const ref = wsByMetaId.get(i.campaign_id);
      const r = rollupRow(i, kpi);

      return {
        metaCampaignId: i.campaign_id,
        name: i.campaign_name || 'Unnamed',
        status: statusMap[i.campaign_id] || 'UNKNOWN',
        objective,
        spend: r.spend,
        results: r.results,
        // `cpl` field name kept for backwards compat in the existing UI; semantically
        // it's the campaign's PRIMARY KPI value (CPL for lead, CPP for sales, etc.).
        cpl: extractKpiValue(r, kpi),
        kpi,
        kpiLabel: KPI_LABELS[kpi] || kpi,
        kpiUnit: KPI_UNIT[kpi] || '$',
        hasWorkspace: !!ref,
        workspaceId: ref?.workspaceId || null,
        hasRetrospective: ref?.hasRetrospective || false,
      };
    });

    // Sort by spend desc.
    campaigns.sort((a, b) => b.spend - a.spend);

    return json({ success: true, campaigns });
  } catch (err: any) {
    console.error('list-campaigns-for-retrospective error:', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function rollupRow(row: any, primaryKpi: string) {
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const cpa = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const findAction = (t: string) => actions.find((a: any) => a.action_type === t);
  const findCpa = (t: string) => cpa.find((a: any) => a.action_type === t);

  const leadCount = Number(findAction('lead')?.value || 0)
    + Number(findAction('offsite_conversion.fb_pixel_lead')?.value || 0);
  const purchaseCount = Number(findAction('purchase')?.value || 0)
    + Number(findAction('offsite_conversion.fb_pixel_purchase')?.value || 0);
  const videoViewCount = Number(findAction('video_view')?.value || 0);

  const cplValue = Number(findCpa('lead')?.value
    || findCpa('offsite_conversion.fb_pixel_lead')?.value
    || (leadCount > 0 ? Number(row.spend || 0) / leadCount : 0)) || null;
  const cppValue = Number(findCpa('purchase')?.value
    || findCpa('offsite_conversion.fb_pixel_purchase')?.value
    || (purchaseCount > 0 ? Number(row.spend || 0) / purchaseCount : 0)) || null;
  const costPerThruPlay = Number(findCpa('video_view')?.value
    || (videoViewCount > 0 ? Number(row.spend || 0) / videoViewCount : 0)) || null;
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
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    ctr: Number(row.ctr || 0),
    cpc: Number(row.cpc || 0),
    cpm: Number(row.cpm || 0),
    cpl_value: cplValue,
    cpp_value: cppValue,
    costPerThruPlay,
    roas: purchaseRoas,
    results,
  };
}

function extractKpiValue(totals: any, kpi: string): number | null {
  if (!totals) return null;
  switch (kpi) {
    case 'cpl': return totals.cpl_value;
    case 'cpp': return totals.cpp_value;
    case 'cpc': return totals.cpc;
    case 'cpm': return totals.cpm;
    case 'ctr': return totals.ctr;
    case 'roas': return totals.roas;
    case 'costPerThruPlay': return totals.costPerThruPlay;
    default: return totals.cpl_value;
  }
}
