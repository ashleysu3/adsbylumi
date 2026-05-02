import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective: string;
  created_time: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

// Map Meta's status / effective_status into our internal token
const mapMetaStatus = (status?: string, effective?: string): string => {
  const s = (effective || status || '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'paused';
  if (s === 'ARCHIVED') return 'archived';
  if (s === 'DELETED') return 'deleted';
  if (s === 'PENDING_REVIEW' || s === 'IN_PROCESS') return 'pending_review';
  if (s === 'DISAPPROVED') return 'disapproved';
  if (s === 'WITH_ISSUES') return 'with_issues';
  return s.toLowerCase() || 'unknown';
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. AUTHENTICATE USER
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create auth client to verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const body = await req.json().catch(() => ({}));
    const {
      brandId,
      metaAccountId: metaAccountIdFromBody,
      metaAccessToken: metaAccessTokenFromBody,
      campaignIds,
    } = (body || {}) as {
      brandId?: string;
      metaAccountId?: string;
      metaAccessToken?: string;
      campaignIds?: string[];
    };

    if (!brandId) {
      throw new Error('brandId is required');
    }

    // Initialize Supabase client (service role)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. VERIFY BRAND OWNERSHIP
    const { data: brandData, error: brandFetchError } = await supabase
      .from('brands')
      .select('user_id, meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();

    if (brandFetchError || !brandData) {
      console.error('Brand not found:', brandId);
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (brandData.user_id !== user.id) {
      // Check if user is admin — admins can access any brand (impersonation support)
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        console.error('Access denied: User', user.id, 'does not own brand', brandId);
        return new Response(
          JSON.stringify({ error: 'Access denied: You do not own this brand' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Admin bypass: User', user.id, 'accessing brand', brandId);
    }

    console.log('Brand ownership verified for user:', user.id);

    // Resolve Meta account ID (can be provided, or pulled from the brand)
    let metaAccountId = metaAccountIdFromBody || brandData.meta_account_id;

    if (!metaAccountId) {
      throw new Error('Meta account not connected. Please select an ad account.');
    }

    // Resolve Meta access token (can be provided, or pulled from brand record)
    // NOTE: get_meta_token currently fails in this environment with a crypto permissions error,
    // so we avoid it here.
    let metaAccessToken = metaAccessTokenFromBody || (brandData as any)?.meta_access_token;

    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    console.log('Starting campaign sync for brand:', brandId);
    console.log('Meta account:', metaAccountId);
    console.log('Specific campaign IDs to sync:', campaignIds || 'all active');

    // Fetch campaigns from Meta API
    const campaignsUrl = `https://graph.facebook.com/v21.0/${metaAccountId}/campaigns?fields=id,name,status,effective_status,objective,created_time,daily_budget,lifetime_budget&limit=500&access_token=${metaAccessToken}`;

    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (!campaignsResponse.ok) {
      console.error('Failed to fetch campaigns from Meta:', campaignsData);
      throw new Error(campaignsData.error?.message || 'Failed to fetch campaigns from Meta');
    }

    const allCampaigns: MetaCampaign[] = campaignsData.data || [];
    console.log(`Fetched ${allCampaigns.length} total campaigns from Meta`);

    // Filter campaigns based on whether specific IDs were provided
    let campaignsToSync: MetaCampaign[];

    if (campaignIds && Array.isArray(campaignIds) && campaignIds.length > 0) {
      // Sync only the specified campaigns (any status)
      const campaignIdSet = new Set(campaignIds);
      campaignsToSync = allCampaigns.filter((campaign) => campaignIdSet.has(campaign.id));
      console.log(`Found ${campaignsToSync.length} campaigns matching specified IDs`);
    } else {
      // Default behavior: sync only active campaigns
      campaignsToSync = allCampaigns.filter((campaign) => campaign.status === 'ACTIVE');
      console.log(`Found ${campaignsToSync.length} active campaigns`);
    }

    if (campaignsToSync.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          skipped: 0,
          message: campaignIds ? 'No matching campaigns found' : 'No active campaigns found to sync',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fetch existing workspaces for this brand to check for duplicates.
    // We also pull campaign_builder_answers so we can merge (not clobber)
    // when backfilling ad-set info onto older rows.
    const { data: existingWorkspaces, error: fetchError } = await supabase
      .from('campaign_workspaces')
      .select('id, meta_campaign_ids, objective, campaign_builder_answers, meta_campaign_status')
      .eq('brand_id', brandId);

    if (fetchError) {
      console.error('Error fetching existing workspaces:', fetchError);
      throw fetchError;
    }

    // Build a map of Meta campaign ID → existing workspace row so we can
    // both skip duplicates AND backfill `objective` on older rows that were
    // imported before the column existed. (One-time heal; subsequent syncs
    // are cheap no-ops.)
    const existingByCampaignId = new Map<string, { id: string; objective: string | null; campaignBuilderAnswers: any; metaCampaignStatus: string | null }>();
    for (const w of existingWorkspaces || []) {
      const campaignId = (w.meta_campaign_ids as any)?.campaignId;
      if (campaignId) {
        existingByCampaignId.set(campaignId, {
          id: w.id,
          objective: (w as any).objective ?? null,
          campaignBuilderAnswers: (w as any).campaign_builder_answers ?? null,
          metaCampaignStatus: (w as any).meta_campaign_status ?? null,
        });
      }
    }
    const existingCampaignIds = new Set(existingByCampaignId.keys());

    // Update select to also include campaign_builder_answers so the backfill
    // path can merge rather than overwrite.

    console.log(`Found ${existingCampaignIds.size} existing campaign workspaces`);

    // Helper: classify an ad-set role by name. Used so the frontend can
    // target "Increase budget" at the Scaling set specifically. Zero-config
    // for users (including Ashley + her agency clients) who already name
    // their sets with "Testing" / "Scaling" conventions.
    const detectAdSetRole = (name: string): 'testing' | 'scaling' | 'other' => {
      const n = (name || '').toLowerCase();
      if (n.includes('scaling') || n.includes('scale ') || n.endsWith(' scale')) return 'scaling';
      if (n.includes('testing') || n.includes('test ') || n.endsWith(' test')) return 'testing';
      return 'other';
    };

    // Helper: fetch ad-set info from Meta for a given campaign, including
    // names + detected roles. Used for both new-campaign inserts and
    // backfills on existing workspaces.
    const fetchAdSetsWithRoles = async (campaignId: string, accessToken: string) => {
      try {
        const url = `https://graph.facebook.com/v21.0/${campaignId}/adsets?fields=id,name,daily_budget,lifetime_budget,status&limit=100&access_token=${accessToken}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!Array.isArray(data?.data)) return [];
        return data.data.map((a: any) => ({
          id: a.id,
          name: a.name,
          role: detectAdSetRole(a.name || ''),
          dailyBudget: a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
          lifetimeBudget: a.lifetime_budget ? parseFloat(a.lifetime_budget) / 100 : null,
          status: a.status,
        }));
      } catch (e) {
        console.error('fetchAdSetsWithRoles failed:', e);
        return [];
      }
    };

    // Helper function to fetch performance data for a campaign
    const fetchCampaignPerformance = async (campaignId: string, accessToken: string) => {
      try {
        const timeRange = 'date_preset=last_7d';
        const insightsUrl = `https://graph.facebook.com/v21.0/${campaignId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&${timeRange}&access_token=${accessToken}`;
        
        const response = await fetch(insightsUrl);
        const data = await response.json();
        
        if (data.error) {
          console.error(`Performance fetch error for ${campaignId}:`, data.error);
          return null;
        }
        
        const metrics = data.data?.[0] || {};
        
        // Extract helper functions
        const extractMetric = (obj: any, field: string, defaultVal = 0) => {
          return parseFloat(obj[field]) || defaultVal;
        };
        
        const extractAction = (actions: any[], actionType: string) => {
          if (!Array.isArray(actions)) return 0;
          const action = actions.find((a: any) => a.action_type === actionType);
          return action ? parseFloat(action.value) || 0 : 0;
        };
        
        const extractCostPerAction = (costPerActions: any[], actionType: string) => {
          if (!Array.isArray(costPerActions)) return 0;
          const action = costPerActions.find((a: any) => a.action_type === actionType);
          return action ? parseFloat(action.value) || 0 : 0;
        };
        
        return {
          spend: extractMetric(metrics, 'spend'),
          impressions: extractMetric(metrics, 'impressions'),
          reach: extractMetric(metrics, 'reach'),
          clicks: extractMetric(metrics, 'clicks'),
          ctr: extractMetric(metrics, 'ctr'),
          cpc: extractMetric(metrics, 'cpc'),
          cpm: extractMetric(metrics, 'cpm'),
          frequency: extractMetric(metrics, 'frequency'),
          leads: extractAction(metrics.actions, 'lead'),
          purchases: extractAction(metrics.actions, 'purchase'),
          addToCart: extractAction(metrics.actions, 'add_to_cart'),
          cpl: extractCostPerAction(metrics.cost_per_action_type, 'lead'),
          cpp: extractCostPerAction(metrics.cost_per_action_type, 'purchase'),
          roas: metrics.purchase_roas ? extractMetric(metrics, 'purchase_roas') : null,
        };
      } catch (error) {
        console.error(`Failed to fetch performance for campaign ${campaignId}:`, error);
        return null;
      }
    };

    // Sync campaigns
    let synced = 0;
    let skipped = 0;
    const syncedCampaigns = [];

    for (const campaign of campaignsToSync) {
      // Check if campaign already exists
      if (existingCampaignIds.has(campaign.id)) {
        // Duplicate path — opportunistically backfill (a) `objective` for
        // rows imported before that column existed and (b) `adSets` so the
        // Scaling-aware budget UI has something to work with on older
        // campaigns (e.g. Lindsay's Masterclass). Merges into existing
        // campaign_builder_answers rather than overwriting.
        const existing = existingByCampaignId.get(campaign.id);
        if (existing) {
          const updates: Record<string, any> = {};

          if (!existing.objective && campaign.objective) {
            updates.objective = campaign.objective;
          }

          // Always refresh adSets on duplicate encounters — names may have
          // changed since import (user renamed Testing/Scaling in Meta).
          const refreshedAdSets = await fetchAdSetsWithRoles(campaign.id, metaAccessToken);
          if (refreshedAdSets.length > 0) {
            const prev = (existing.campaignBuilderAnswers as any) || {};
            updates.campaign_builder_answers = { ...prev, adSets: refreshedAdSets };
          }

          if (Object.keys(updates).length > 0) {
            const { error: backfillError } = await supabase
              .from('campaign_workspaces')
              .update(updates)
              .eq('id', existing.id);
            if (backfillError) {
              console.error(`Backfill failed for ${campaign.id}:`, backfillError);
            } else {
              console.log(
                `Backfilled existing workspace ${existing.id}: ${Object.keys(updates).join(', ')}`,
              );
            }
          }
        }
        console.log(`Skipping duplicate campaign: ${campaign.name} (${campaign.id})`);
        skipped++;
        continue;
      }

      // Determine campaign status based on Meta status
      const metaStatus = campaign.status === 'ACTIVE' ? 'active' : 
                         campaign.status === 'PAUSED' ? 'paused' : 
                         campaign.status === 'ARCHIVED' ? 'archived' : 'unknown';

      // ============================================
      // BUDGET RESOLUTION: Campaign-level or ad set aggregation
      // ============================================
      let resolvedDailyBudget: number | null = null;
      let budgetLevel: string | null = null;

      // Campaign-level budget (Meta returns cents/minor units → convert to dollars)
      if (campaign.daily_budget) {
        resolvedDailyBudget = parseFloat(campaign.daily_budget) / 100;
        budgetLevel = 'campaign';
      }

      // Always fetch ad-set info (name, budget, status) so we have it for
      // the Scaling-aware budget UI even when the campaign is CBO. Roles
      // are detected from the ad-set name.
      const adSetsWithRoles = await fetchAdSetsWithRoles(campaign.id, metaAccessToken);

      // If no campaign-level budget, aggregate active ad-set daily budgets.
      if (!resolvedDailyBudget && adSetsWithRoles.length > 0) {
        let totalDailyBudget = 0;
        let hasDaily = false;
        for (const adSet of adSetsWithRoles) {
          if (adSet.status !== 'ACTIVE') continue;
          if (adSet.dailyBudget) {
            totalDailyBudget += adSet.dailyBudget;
            hasDaily = true;
          }
        }
        if (hasDaily) {
          resolvedDailyBudget = totalDailyBudget;
          budgetLevel = 'adset';
        }
      }

      console.log(`Campaign ${campaign.name}: budget=$${resolvedDailyBudget}, level=${budgetLevel}, adSets=${adSetsWithRoles.length}`);

      // Fetch initial performance data
      console.log(`Fetching performance data for: ${campaign.name} (${campaign.id})`);
      const performanceMetrics = await fetchCampaignPerformance(campaign.id, metaAccessToken);
      
      // Prepare initial performance snapshot if data was fetched
      const initialPerformanceHistory = performanceMetrics ? [{
        metrics: performanceMetrics,
        dateRange: {
          start: 'last_7d',
          end: 'last_7d',
        },
        syncedAt: new Date().toISOString(),
      }] : [];

      // Store budget + ad-set info in campaign_builder_answers so the UI
      // can read both. adSets includes detected roles (testing/scaling/other)
      // which the Scaling-aware budget UI uses to target the Scaling set.
      const builderAnswers: Record<string, any> | null = (() => {
        const out: Record<string, any> = {};
        if (resolvedDailyBudget) {
          out.budget = resolvedDailyBudget;
          out.budgetLevel = budgetLevel;
        }
        if (adSetsWithRoles.length > 0) {
          out.adSets = adSetsWithRoles;
        }
        return Object.keys(out).length > 0 ? out : null;
      })();

      // Create new workspace record with initial performance data
      const { data: newWorkspace, error: insertError } = await supabase
        .from('campaign_workspaces')
        .insert({
          brand_id: brandId,
          name: campaign.name,
          meta_campaign_ids: { campaignId: campaign.id },
          meta_campaign_status: metaStatus,
          objective: campaign.objective ?? null,
          progress_status: 'imported',
          published_at: new Date().toISOString(),
          performance_history: initialPerformanceHistory,
          meta_insights_last_sync: performanceMetrics ? new Date().toISOString() : null,
          campaign_builder_answers: builderAnswers,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to create workspace for campaign ${campaign.id}:`, insertError);
        skipped++;
        continue;
      }

      console.log(`Synced campaign with performance data: ${campaign.name} (${campaign.id})`);
      synced++;
      syncedCampaigns.push({
        id: campaign.id,
        name: campaign.name,
        workspaceId: newWorkspace.id,
        hasPerformanceData: !!performanceMetrics,
        dailyBudget: resolvedDailyBudget,
        budgetLevel,
      });
    }

    console.log(`Campaign sync complete: ${synced} synced, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true,
        synced,
        skipped,
        campaigns: syncedCampaigns,
        message: `Successfully synced ${synced} campaign${synced !== 1 ? 's' : ''}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in sync-meta-campaigns:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
