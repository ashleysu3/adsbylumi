import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// list-campaigns-for-retrospective (Patch #26)
//
// Same broader action_type aggregation as the retrospective function so the
// tray's per-row counters don't miss Lead Form / on-site conversions.
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

const LEAD_ACTION_TYPES = [
  'lead', 'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.lead_grouped', 'onsite_conversion.lead', 'submit_application_total',
];
const PURCHASE_ACTION_TYPES = [
  'purchase', 'offsite_conversion.fb_pixel_purchase',
  'onsite_conversion.purchase', 'omni_purchase',
];
const VIDEO_VIEW_ACTION_TYPES = ['video_view', 'video_thruplay_watched_actions'];

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

    const { brandId, startDate, endDate } = await req.json();
    if (!brandId || !startDate || !endDate) return json({ error: 'brandId, startDate, endDate are required' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: brand, error: bErr } = await sb
      .from('brands').select('id, user_id, meta_account_id, meta_access_token').eq('id', brandId).single();
    if (bErr || !brand) return json({ error: 'Brand not found' }, 404);
    if (brand.user_id !== user.id) {
      const { data: roleRow } = await sb
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      const { data: teamRow } = await sb
        .from('brand_team_members').select('id')
        .eq('brand_id', brandId).eq('user_id', user.id).eq('invite_status', 'accepted').maybeSingle();
      if (!roleRow && !teamRow) return json({ error: 'Forbidden' }, 403);
    }
    if (!brand.meta_account_id || !brand.meta_access_token) return json({ error: 'This brand is not connected to Meta yet' }, 400);

    const fields = [
      'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks',
      'ctr', 'cpc', 'cpm', 'actions', 'cost_per_action_type',
      'purchase_roas', 'objective',
    ].join(',');
    const insightsUrl =
      `https://graph.facebook.com/v25.0/${brand.meta_account_id}/insights` +
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

    let statusMap: Record<string, string> = {};
    if (insightsArr.length > 0) {
      const campsRes = await fetch(
        `https://graph.facebook.com/v25.0/${brand.meta_account_id}/campaigns?fields=id,status,objective&limit=500&access_token=${brand.meta_access_token}`,
      );
      const campsData = await campsRes.json();
      if (campsRes.ok && Array.isArray(campsData?.data)) {
        for (const c of campsData.data) {
          if (c?.id) statusMap[c.id] = c.status || 'UNKNOWN';
        }
      }
    }

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
        metaCampaignId: i.campaign_id, name: i.campaign_name || 'Unnamed',
        status: statusMap[i.campaign_id] || 'UNKNOWN', objective,
        spend: r.spend, results: r.results,
        cpl: extractKpiValue(r, kpi),
        kpi, kpiLabel: KPI_LABELS[kpi] || kpi, kpiUnit: KPI_UNIT[kpi] || '$',
        hasWorkspace: !!ref, workspaceId: ref?.workspaceId || null,
        hasRetrospective: ref?.hasRetrospective || false,
      };
    });
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
    roas: purchaseRoas, results,
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
