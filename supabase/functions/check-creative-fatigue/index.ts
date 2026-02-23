import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Get all brands with Meta accounts
    const { data: brands, error: brandsErr } = await supabaseAdmin
      .from('brands')
      .select('id, user_id, meta_account_id, name')
      .not('meta_account_id', 'is', null);

    if (brandsErr) throw brandsErr;
    if (!brands || brands.length === 0) {
      return new Response(JSON.stringify({ message: 'No brands with Meta accounts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const brand of brands) {
      try {
        // Get Meta token
        let metaToken: string | null = null;
        try {
          // Use service role to get token directly from brand or vault
          const { data: brandData } = await supabaseAdmin
            .from('brands')
            .select('meta_access_token')
            .eq('id', brand.id)
            .single();
          metaToken = brandData?.meta_access_token || null;
        } catch { /* skip */ }

        if (!metaToken) {
          results.push({ brand: brand.name, status: 'skipped', reason: 'No token' });
          continue;
        }

        // Get workspaces with live campaigns and auto-rotate settings
        const { data: workspaces } = await supabaseAdmin
          .from('campaign_workspaces')
          .select('id, name, meta_campaign_ids, auto_rotate_enabled, rotation_preferences')
          .eq('brand_id', brand.id)
          .not('meta_campaign_ids', 'is', null);

        if (!workspaces || workspaces.length === 0) continue;

        for (const workspace of workspaces) {
          const campaignIds = workspace.meta_campaign_ids as any;
          const campaignId = campaignIds?.campaignId;
          if (!campaignId) continue;

          // Fetch ad-level insights from Meta for last 7 days
          const since = new Date();
          since.setDate(since.getDate() - 7);
          const sinceStr = since.toISOString().split('T')[0];
          const untilStr = new Date().toISOString().split('T')[0];

          const adsUrl = `https://graph.facebook.com/v21.0/${campaignId}/ads?fields=id,name,status,insights.date_preset(last_7d){impressions,clicks,ctr,frequency,reach,spend}&access_token=${metaToken}`;
          
          const adsRes = await fetch(adsUrl);
          const adsData = await adsRes.json();

          if (adsData.error) {
            results.push({ brand: brand.name, workspace: workspace.name, status: 'error', reason: adsData.error.message });
            continue;
          }

          const ads = adsData.data || [];
          const prefs = (workspace.rotation_preferences as any) || {};
          const fatigueThreshold = prefs.fatigue_frequency_threshold || 4;
          const retestCooldownDays = prefs.retest_cooldown_days || 14;

          const fatiguedAds: any[] = [];
          const underperformers: any[] = [];

          for (const ad of ads) {
            if (ad.status !== 'ACTIVE') continue;
            const insights = ad.insights?.data?.[0];
            if (!insights) continue;

            const frequency = parseFloat(insights.frequency || '0');
            const ctr = parseFloat(insights.ctr || '0');
            const reach = parseInt(insights.reach || '0');

            // Fatigue detection: frequency >= threshold
            if (frequency >= fatigueThreshold) {
              fatiguedAds.push({
                adId: ad.id,
                adName: ad.name,
                frequency,
                ctr,
                reach,
                reason: `Frequency ${frequency.toFixed(1)} exceeds threshold ${fatigueThreshold}`,
              });
            }

            // Underperformer detection: CTR < 0.8% AND reach >= 1000
            if (ctr < 0.8 && reach >= 1000) {
              underperformers.push({
                adId: ad.id,
                adName: ad.name,
                ctr,
                reach,
                reason: `CTR ${ctr.toFixed(2)}% below 0.8% with ${reach} reach`,
              });
            }

            // Sync performance snapshot to creative_bench
            await supabaseAdmin
              .from('creative_bench')
              .update({
                performance_snapshot: {
                  ctr,
                  frequency,
                  reach,
                  spend: parseFloat(insights.spend || '0'),
                  impressions: parseInt(insights.impressions || '0'),
                  clicks: parseInt(insights.clicks || '0'),
                  last_checked: new Date().toISOString(),
                },
              })
              .eq('meta_ad_id', ad.id)
              .eq('workspace_id', workspace.id);
          }

          const allIssues = [...fatiguedAds, ...underperformers];
          if (allIssues.length === 0) {
            results.push({ brand: brand.name, workspace: workspace.name, status: 'healthy' });
            continue;
          }

          // Check for available bench creative
          const { data: benchItems } = await supabaseAdmin
            .from('creative_bench')
            .select('*')
            .eq('workspace_id', workspace.id)
            .eq('status', 'bench')
            .eq('auto_rotate_approved', true)
            .limit(allIssues.length);

          const autoRotateEnabled = workspace.auto_rotate_enabled || false;

          if (autoRotateEnabled && benchItems && benchItems.length > 0) {
            // Auto-rotate: swap fatigued ads with bench items
            for (let i = 0; i < Math.min(fatiguedAds.length, benchItems.length); i++) {
              const fatigued = fatiguedAds[i];
              const bench = benchItems[i];

              // Call rotate-creative function
              const rotateUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/rotate-creative`;
              await fetch(rotateUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({
                  workspaceId: workspace.id,
                  brandId: brand.id,
                  fatigueAdId: fatigued.adId,
                  benchAdId: bench.meta_ad_id,
                  reason: fatigued.reason,
                  isAutoRotation: true,
                }),
              });
            }

            results.push({
              brand: brand.name,
              workspace: workspace.name,
              status: 'auto_rotated',
              fatiguedCount: fatiguedAds.length,
              rotatedCount: Math.min(fatiguedAds.length, benchItems.length),
            });
          } else {
            // Check for retest-eligible ads
            if (prefs.auto_retest_enabled) {
              const retestDate = new Date();
              retestDate.setDate(retestDate.getDate() - retestCooldownDays);

              const { data: retestable } = await supabaseAdmin
                .from('creative_bench')
                .select('*')
                .eq('workspace_id', workspace.id)
                .eq('status', 'paused')
                .lte('paused_at', retestDate.toISOString())
                .limit(1);

              if (retestable && retestable.length > 0) {
                results.push({
                  brand: brand.name,
                  workspace: workspace.name,
                  status: 'retest_available',
                  retestableCount: retestable.length,
                });
              }
            }

            // Log fatigue detection for notification
            for (const fatigued of fatiguedAds) {
              await supabaseAdmin.from('creative_rotation_log').insert({
                workspace_id: workspace.id,
                brand_id: brand.id,
                action: 'pause_fatigue',
                old_ad_id: fatigued.adId,
                reason: fatigued.reason,
              });
            }

            results.push({
              brand: brand.name,
              workspace: workspace.name,
              status: 'fatigue_detected',
              fatiguedCount: fatiguedAds.length,
              underperformerCount: underperformers.length,
              benchAvailable: benchItems?.length || 0,
              autoRotateEnabled,
            });
          }
        }
      } catch (brandErr) {
        console.error(`Error processing brand ${brand.name}:`, brandErr);
        results.push({ brand: brand.name, status: 'error', reason: brandErr.message });
      }
    }

    // Send summary to Slack
    try {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY');

      if (LOVABLE_API_KEY && SLACK_API_KEY) {
        const fatigueResults = results.filter(r => r.status === 'fatigue_detected' || r.status === 'auto_rotated');
        if (fatigueResults.length > 0) {
          const lines = fatigueResults.map(r => {
            if (r.status === 'auto_rotated') {
              return `• ✅ *${r.workspace}* (${r.brand}): Auto-rotated ${r.rotatedCount} of ${r.fatiguedCount} fatigued ads`;
            }
            return `• ⚠️ *${r.workspace}* (${r.brand}): ${r.fatiguedCount} fatigued, ${r.benchAvailable} bench available`;
          });

          await fetch('https://connector-gateway.lovable.dev/slack/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': SLACK_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: 'lumi-alerts',
              text: `🎨 Creative Fatigue Check\n${lines.join('\n')}`,
              username: 'Lumi',
              icon_emoji: ':sparkles:',
            }),
          });
        }
      }
    } catch (slackErr) {
      console.error('Slack notification failed:', slackErr);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('check-creative-fatigue error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
