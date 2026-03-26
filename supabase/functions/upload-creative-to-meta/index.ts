import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // When called from another edge function with the service role key, skip user auth
    // (the calling function already verified ownership)
    const isServiceCall = authHeader === `Bearer ${supabaseServiceKey}`;

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isServiceCall) {
      // Create auth client with user's token
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        console.error('Authentication failed:', authError?.message);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('User authenticated:', user.id);
    } else {
      console.log('Service-to-service call authenticated');
    }

    // 2. Parse request - NOTE: We no longer accept metaAccessToken as a parameter
    const { assetUrl, assetStoragePath, brandId, fileName } = await req.json();

    if (!brandId) {
      console.error('Missing brandId parameter');
      return new Response(
        JSON.stringify({ success: false, error: 'Brand ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verify brand exists and get Meta details
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('user_id, meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('Brand not found:', brandId);
      return new Response(
        JSON.stringify({ success: false, error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only check ownership for direct user calls, not service-to-service
    if (!isServiceCall) {
      // Re-authenticate to get user for ownership check
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (brand.user_id !== user?.id) {
        console.error('Access denied: User', user?.id, 'does not own brand', brandId);
        return new Response(
          JSON.stringify({ success: false, error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const metaAccountId = brand.meta_account_id;
    if (!metaAccountId) {
      console.error('No Meta account connected for brand:', brandId);
      return new Response(
        JSON.stringify({ success: false, error: 'No Meta account connected for this brand' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Read Meta token from brand (project token storage pattern)
    const metaAccessToken = brand.meta_access_token;

    if (!metaAccessToken) {
      console.error('Meta token missing on brand:', brandId);
      return new Response(
        JSON.stringify({ success: false, error: 'Meta token not found. Please reconnect your Meta account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validate storage path belongs to this brand (if provided)
    if (assetStoragePath && !assetStoragePath.startsWith(`${brandId}/`)) {
      console.error('Invalid asset path for brand:', brandId, 'path:', assetStoragePath);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid asset path' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Uploading asset to Meta:', assetStoragePath || assetUrl);

    let assetData: Blob;
    let contentType: string;

    // If we have a storage path, download from Supabase Storage
    if (assetStoragePath) {
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('creative-assets')
        .download(assetStoragePath);

      if (downloadError) {
        console.error('Download error:', downloadError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to download asset: ${downloadError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      assetData = downloadData;
      contentType = downloadData.type;
    } else if (assetUrl) {
      // If we have a URL, fetch it directly
      const response = await fetch(assetUrl);
      if (!response.ok) {
        console.error('Failed to fetch asset from URL:', response.statusText);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch asset from URL: ${response.statusText}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      assetData = await response.blob();
      contentType = response.headers.get('content-type') || 'application/octet-stream';
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Either assetUrl or assetStoragePath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine if image or video based on content type or file extension
    const isVideo = contentType.startsWith('video/') || 
      (fileName && /\.(mp4|mov|avi|webm)$/i.test(fileName)) ||
      (assetStoragePath && /\.(mp4|mov|avi|webm)$/i.test(assetStoragePath));

    const accountId = metaAccountId.replace('act_', '');

    if (isVideo) {
      // Upload video using resumable upload
      console.log('Uploading video to Meta...');
      
      // Step 1: Initialize upload session
      const initResponse = await fetch(
        `https://graph.facebook.com/v21.0/act_${accountId}/advideos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            access_token: metaAccessToken,
            upload_phase: 'start',
            file_size: assetData.size.toString(),
          }),
        }
      );

      const initData = await initResponse.json();
      
      if (initData.error) {
        console.error('Video upload init error:', initData.error);
        return new Response(
          JSON.stringify({ success: false, error: initData.error.message || 'Failed to initialize video upload' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { upload_session_id, video_id } = initData;
      console.log('Video upload session started:', upload_session_id);

      // Step 2: Upload video data
      const formData = new FormData();
      formData.append('access_token', metaAccessToken);
      formData.append('upload_phase', 'transfer');
      formData.append('upload_session_id', upload_session_id);
      formData.append('start_offset', '0');
      formData.append('video_file_chunk', assetData, fileName || 'video.mp4');

      const transferResponse = await fetch(
        `https://graph.facebook.com/v21.0/act_${accountId}/advideos`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const transferData = await transferResponse.json();
      
      if (transferData.error) {
        console.error('Video transfer error:', transferData.error);
        return new Response(
          JSON.stringify({ success: false, error: transferData.error.message || 'Failed to transfer video' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 3: Finish upload
      const finishResponse = await fetch(
        `https://graph.facebook.com/v21.0/act_${accountId}/advideos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            access_token: metaAccessToken,
            upload_phase: 'finish',
            upload_session_id: upload_session_id,
          }),
        }
      );

      const finishData = await finishResponse.json();
      
      if (finishData.error) {
        console.error('Video finish error:', finishData.error);
        return new Response(
          JSON.stringify({ success: false, error: finishData.error.message || 'Failed to finish video upload' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Video uploaded successfully:', video_id);

      return new Response(
        JSON.stringify({
          success: true,
          assetId: video_id,
          assetType: 'video',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Upload image
      console.log('Uploading image to Meta...');

      // Convert blob to base64
      const arrayBuffer = await assetData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const imageResponse = await fetch(
        `https://graph.facebook.com/v21.0/act_${accountId}/adimages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            access_token: metaAccessToken,
            bytes: base64,
          }),
        }
      );

      const imageData = await imageResponse.json();

      if (imageData.error) {
        console.error('Image upload error:', imageData.error);
        return new Response(
          JSON.stringify({ success: false, error: imageData.error.message || 'Failed to upload image' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract hash from response - response format is { images: { bytes: { hash: "...", url: "..." } } }
      const imageKey = Object.keys(imageData.images || {})[0];
      const imageHash = imageData.images?.[imageKey]?.hash;

      if (!imageHash) {
        console.error('Unexpected image response:', imageData);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get image hash from Meta response' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Image uploaded successfully:', imageHash);

      return new Response(
        JSON.stringify({
          success: true,
          assetId: imageHash,
          assetType: 'image',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
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
