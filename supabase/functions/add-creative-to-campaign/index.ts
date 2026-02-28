import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse request
    const { workspaceId, assets, copyVariations } = await req.json();

    if (!workspaceId || !assets?.length || !copyVariations?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspaceId, assets, and copyVariations are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch workspace + brand
    const { data: workspace, error: wsError } = await supabase
      .from('campaign_workspaces')
      .select('*, brands!inner(id, name, user_id, meta_account_id, page_id)')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const brand = workspace.brands;

    // 4. Verify ownership
    if (brand.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check existing campaign has ad sets
    const metaCampaignIds = workspace.meta_campaign_ids as any;
    if (!metaCampaignIds?.ad_set_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No existing ad set found. Use Build Campaign instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adSetId = metaCampaignIds.ad_set_id;
    const metaAccountId = brand.meta_account_id;
    const pageId = brand.page_id;

    if (!metaAccountId || !pageId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta account or Page not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Get Meta token
    const { data: metaAccessToken, error: tokenError } = await supabase
      .rpc('get_meta_token', { p_brand_id: brand.id });

    if (tokenError || !metaAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta token not found. Please reconnect your Meta account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountId = metaAccountId.replace('act_', '');
    const offerUrl = workspace.offer_url || '';

    console.log(`Adding ${assets.length} creative(s) with ${copyVariations.length} copy variation(s) to ad set ${adSetId}`);

    const createdAdIds: string[] = [];
    const failedAds: Array<{ assetName: string; error: string }> = [];

    // 7. For each asset, upload to Meta then create ads with each copy variation
    for (const asset of assets) {
      console.log(`Processing asset: ${asset.name}`);

      // Upload asset to Meta
      let uploadResult: any;
      try {
        const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/upload-creative-to-meta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            assetStoragePath: asset.storage_path,
            brandId: brand.id,
            fileName: asset.name,
          }),
        });

        uploadResult = await uploadResponse.json();

        if (!uploadResult.success || !uploadResult.assetId) {
          console.error(`Upload failed for ${asset.name}:`, uploadResult.error);
          failedAds.push({ assetName: asset.name, error: `Upload failed: ${uploadResult.error || 'Unknown'}` });
          continue;
        }
      } catch (e: any) {
        console.error(`Upload error for ${asset.name}:`, e);
        failedAds.push({ assetName: asset.name, error: `Upload error: ${e.message}` });
        continue;
      }

      const { assetId, assetType } = uploadResult;
      console.log(`Asset uploaded to Meta: ${assetType} ${assetId}`);

      // Create one ad per copy variation for this asset
      for (let vi = 0; vi < copyVariations.length; vi++) {
        const copy = copyVariations[vi];
        const adName = `Ad - ${asset.name.replace(/\.[^/.]+$/, '')} - V${vi + 1}`;

        try {
          // Build object_story_spec
          let objectStorySpec: any;

          if (assetType === 'video') {
            objectStorySpec = {
              page_id: pageId,
              video_data: {
                video_id: assetId,
                title: copy.headline || 'Watch Now',
                message: copy.primary_text || '',
                link_description: copy.description || '',
                call_to_action: {
                  type: 'LEARN_MORE',
                  value: { link: offerUrl }
                }
              }
            };
          } else {
            objectStorySpec = {
              page_id: pageId,
              link_data: {
                image_hash: assetId,
                link: offerUrl,
                message: copy.primary_text || '',
                name: copy.headline || '',
                description: copy.description || '',
                call_to_action: { type: 'LEARN_MORE' }
              }
            };
          }

          // Create ad creative
          const creativeResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/adcreatives`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                name: `Creative - ${adName}`,
                object_story_spec: JSON.stringify(objectStorySpec),
                access_token: metaAccessToken
              })
            }
          );

          const creativeData = await creativeResponse.json();
          if (creativeData.error) {
            console.error(`Creative failed for ${adName}:`, creativeData.error);
            failedAds.push({ assetName: asset.name, error: `Creative: ${creativeData.error.message}` });
            continue;
          }

          // Create ad in existing ad set
          const adResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/ads`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                adset_id: adSetId,
                name: adName,
                creative: JSON.stringify({ creative_id: creativeData.id }),
                status: 'PAUSED',
                access_token: metaAccessToken
              })
            }
          );

          const adData = await adResponse.json();
          if (adData.error) {
            console.error(`Ad creation failed for ${adName}:`, adData.error);
            failedAds.push({ assetName: asset.name, error: `Ad: ${adData.error.message}` });
            continue;
          }

          createdAdIds.push(adData.id);
          console.log(`Ad created: ${adData.id} (${adName})`);
        } catch (adError: any) {
          console.error(`Error creating ad ${adName}:`, adError);
          failedAds.push({ assetName: asset.name, error: adError.message });
        }
      }
    }

    // 8. Update workspace with new ad IDs
    const existingAdIds = metaCampaignIds.ad_ids || [];
    const allAdIds = [...existingAdIds, ...createdAdIds];

    await supabase
      .from('campaign_workspaces')
      .update({
        meta_campaign_ids: {
          ...metaCampaignIds,
          ad_ids: allAdIds,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    const success = createdAdIds.length > 0;
    const message = success
      ? `${createdAdIds.length} new ad(s) added to your campaign.${failedAds.length > 0 ? ` ${failedAds.length} failed.` : ''} Ads are paused — activate in Ads Manager when ready.`
      : 'Failed to create any ads. Please check your assets and try again.';

    console.log(message);

    return new Response(
      JSON.stringify({
        success,
        adIds: createdAdIds,
        totalCreated: createdAdIds.length,
        totalFailed: failedAds.length,
        failedAds,
        message,
      }),
      {
        status: success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('add-creative-to-campaign error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
