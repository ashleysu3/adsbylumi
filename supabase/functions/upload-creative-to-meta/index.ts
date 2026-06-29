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

    // Detect service-to-service calls (when build-meta-campaign calls this function)
    const token = authHeader.replace('Bearer ', '');
    const isServiceCall = token === supabaseServiceKey;

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string | null = null;

    if (!isServiceCall) {
      // Normal user call — authenticate via session token
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
      userId = user.id;
      console.log('User authenticated:', user.id);
    } else {
      console.log('Service-to-service call detected, skipping user auth');
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
    if (userId && brand.user_id !== userId) {
      console.error('Access denied: User', userId, 'does not own brand', brandId);
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          JSON.stringify({ success: false, error: `Couldn't read your file from storage: ${downloadError.message}. Try re-uploading the file in LUMI and publishing again.` }),
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
          JSON.stringify({ success: false, error: `Couldn't download your file from its source URL (HTTP ${response.status}). Re-upload the file in LUMI and try again.` }),
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

    // ----- Pre-flight: validate type + size BEFORE we hit Meta -----
    // These caps match what Meta will accept; failing fast here gives the
    // user a specific message instead of a generic "non-2xx" from Graph.
    const MAX_IMAGE_BYTES = 30 * 1024 * 1024;        // Meta hard cap ~30MB
    const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;      // 1GB practical cap
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'];
    const lowerName = (fileName || assetStoragePath || '').toLowerCase();
    const looksLikeVideoByName = /\.(mp4|mov|m4v|webm|avi)$/i.test(lowerName);
    const looksLikeImageByName = /\.(jpe?g|png|webp|gif)$/i.test(lowerName);

    const isVideo =
      contentType.startsWith('video/') ||
      (!contentType.startsWith('image/') && looksLikeVideoByName);

    if (!isVideo && !contentType.startsWith('image/') && !looksLikeImageByName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Meta can't use this file type (${contentType || 'unknown'}). Upload a JPG, PNG, WEBP, or GIF image — or an MP4 / MOV video.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (assetData.size === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "This file is empty (0 bytes). Re-upload it in LUMI and try again." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isVideo) {
      if (contentType && !contentType.startsWith('video/') && !ALLOWED_VIDEO_TYPES.includes(contentType) && !looksLikeVideoByName) {
        return new Response(
          JSON.stringify({ success: false, error: `Meta doesn't accept this video format (${contentType}). Use MP4 or MOV.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (assetData.size > MAX_VIDEO_BYTES) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `This video is ${(assetData.size / 1024 / 1024).toFixed(0)}MB. Meta's limit is 1GB — please compress it and re-upload.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      if (contentType && !ALLOWED_IMAGE_TYPES.includes(contentType) && !looksLikeImageByName) {
        return new Response(
          JSON.stringify({ success: false, error: `Meta doesn't accept this image format (${contentType}). Use JPG, PNG, WEBP, or GIF.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (assetData.size > MAX_IMAGE_BYTES) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `This image is ${(assetData.size / 1024 / 1024).toFixed(1)}MB. Meta's limit is 30MB — please resize or compress it.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const accountId = metaAccountId.replace('act_', '');

    // Translate raw Meta Graph errors into copy a non-technical creator can act on.
    const friendlyMetaError = (err: any, fallback: string): string => {
      if (!err) return fallback;
      const code = err.code;
      const sub = err.error_subcode;
      const msg = err.message || err.error_user_msg || '';
      if (code === 190 || sub === 463 || sub === 467) {
        return "Your Meta connection has expired. Reconnect Meta in Settings and try again.";
      }
      if (code === 200 || code === 10 || code === 294) {
        return "Meta says LUMI doesn't have permission to upload to this ad account. Reconnect Meta and make sure you grant ad-account access.";
      }
      if (code === 100 && /file|format|image|video|size|dimension/i.test(msg)) {
        return `Meta rejected this file: ${msg}. Try a different image (JPG/PNG, under 30MB) or video (MP4/MOV, vertical 9:16).`;
      }
      if (code === 1 || code === 2 || code === 4 || code === 17 || code === 32) {
        return "Meta is rate-limiting or temporarily failing. Wait a minute and try again.";
      }
      return msg || fallback;
    };


    if (isVideo) {
      // Upload video using resumable upload
      console.log('Uploading video to Meta...');
      
      // Step 1: Initialize upload session
      const initResponse = await fetch(
        `https://graph.facebook.com/v25.0/act_${accountId}/advideos`,
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
        `https://graph.facebook.com/v25.0/act_${accountId}/advideos`,
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
        `https://graph.facebook.com/v25.0/act_${accountId}/advideos`,
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

      // Use multipart upload to avoid loading and re-encoding large assets in memory
      const imageFormData = new FormData();
      imageFormData.append('access_token', metaAccessToken);
      imageFormData.append('filename', assetData, fileName || 'image.jpg');

      const imageResponse = await fetch(
        `https://graph.facebook.com/v25.0/act_${accountId}/adimages`,
        {
          method: 'POST',
          body: imageFormData,
        }
      );

      const imageRawText = await imageResponse.text();
      let imageData: any = null;
      try {
        imageData = imageRawText ? JSON.parse(imageRawText) : null;
      } catch {
        imageData = null;
      }

      if (!imageResponse.ok || imageData?.error) {
        const imageErrorMessage =
          imageData?.error?.message ||
          imageData?.message ||
          (imageRawText?.trim() ? imageRawText.trim().slice(0, 500) : '') ||
          `Meta image upload failed (HTTP ${imageResponse.status})`;

        console.error('Image upload error:', {
          status: imageResponse.status,
          response: imageData,
          raw: imageRawText?.slice(0, 500) || '',
        });

        return new Response(
          JSON.stringify({ success: false, error: imageErrorMessage }),
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
    const errorMessage =
      (typeof error?.message === 'string' && error.message) ||
      (typeof error === 'string' && error) ||
      'Unexpected upload error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
