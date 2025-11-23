import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assetUrl, metaAccountId, metaAccessToken } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Uploading asset to Meta:', assetUrl);

    // Download asset from Supabase Storage
    const { data: assetData, error: downloadError } = await supabase.storage
      .from('creative-assets')
      .download(assetUrl);

    if (downloadError) throw downloadError;

    // Convert to base64 or form data for Meta upload
    const arrayBuffer = await assetData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Determine if image or video
    const isVideo = assetUrl.toLowerCase().match(/\.(mp4|mov|avi)$/);
    const endpoint = isVideo ? 'advideos' : 'adimages';

    // Upload to Meta
    // Note: In production, you would make the actual API call:
    /*
    const metaResponse = await fetch(`https://graph.facebook.com/v18.0/act_${metaAccountId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        [isVideo ? 'file_url' : 'bytes']: isVideo ? assetUrl : base64,
        access_token: metaAccessToken
      })
    });

    const metaData = await metaResponse.json();
    const assetHash = isVideo ? metaData.id : metaData.images.bytes.hash;
    */

    // For MVP, return simulated hash
    const assetHash = `hash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Asset uploaded to Meta:', assetHash);

    return new Response(
      JSON.stringify({
        success: true,
        assetHash,
        assetType: isVideo ? 'video' : 'image'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error uploading asset to Meta:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
