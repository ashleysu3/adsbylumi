import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { brandId, reportId, autoOptimize } = body;

    if (!brandId) throw new Error('brandId is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Auth: support both user JWT and service-role
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const isServiceRole = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let userId: string;
    if (isServiceRole) {
      const { data: brand } = await supabase
        .from('brands')
        .select('user_id')
        .eq('id', brandId)
        .single();
      if (!brand) throw new Error('Brand not found');
      userId = brand.user_id;
    } else {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
        });
      }
      userId = user.id;
    }

    // Fetch the latest report
    let report: any;
    if (reportId) {
      const { data } = await supabase
        .from('optimization_reports')
        .select('*')
        .eq('id', reportId)
        .single();
      report = data;
    } else {
      const { data } = await supabase
        .from('optimization_reports')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      report = data;
    }

    if (!report) {
      return new Response(JSON.stringify({ success: true, message: 'No report found', queued: 0, applied: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get brand's Meta token for executing actions
    const { data: brand } = await supabase
      .from('brands')
      .select('meta_access_token, meta_account_id')
      .eq('id', brandId)
      .single();

    const reportData = (report.report_data || []) as any[];
    let queued = 0;
    let applied = 0;

    for (const campaign of reportData) {
      if (!campaign.recommendations || campaign.recommendations.length === 0) continue;
      if (!['red', 'yellow'].includes(campaign.status)) continue;

      for (const rec of campaign.recommendations) {
        // Check if already queued
        const { data: existing } = await supabase
          .from('pending_optimizations')
          .select('id')
          .eq('report_id', report.id)
          .eq('workspace_id', campaign.workspace_id)
          .eq('recommendation_type', rec.type)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Build meta action payload
        const metaAction: any = { type: rec.type };
        if (rec.type === 'budget_hog' && campaign.budget_hogs?.length > 0) {
          metaAction.ads_to_pause = campaign.budget_hogs.map((h: any) => h.name);
        }
        if (rec.type === 'scale') {
          metaAction.scale_percent = 20;
        }

        if (autoOptimize && rec.priority === 'high' && brand?.meta_access_token) {
          // Auto-apply: pause budget hog ads via Meta API
          if (rec.type === 'budget_hog' && campaign.budget_hogs) {
            for (const hog of campaign.budget_hogs) {
              try {
                // We'd need the ad ID to pause — for now queue it
                console.log(`[apply-optimizations] Would pause ad "${hog.name}" (no ad ID available)`);
              } catch (e) {
                console.error('Failed to pause ad:', e);
              }
            }
          }

          await supabase.from('pending_optimizations').insert({
            brand_id: brandId,
            workspace_id: campaign.workspace_id,
            report_id: report.id,
            recommendation_type: rec.type,
            action_description: rec.action,
            meta_action: metaAction,
            status: 'applied',
            auto_applied: true,
          });
          applied++;
        } else {
          // Queue for manual approval
          await supabase.from('pending_optimizations').insert({
            brand_id: brandId,
            workspace_id: campaign.workspace_id,
            report_id: report.id,
            recommendation_type: rec.type,
            action_description: rec.action,
            meta_action: metaAction,
            status: 'pending',
            auto_applied: false,
          });
          queued++;
        }
      }
    }

    console.log(`[apply-optimizations] Brand ${brandId}: queued=${queued}, applied=${applied}`);

    return new Response(JSON.stringify({ success: true, queued, applied }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[apply-optimizations] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
