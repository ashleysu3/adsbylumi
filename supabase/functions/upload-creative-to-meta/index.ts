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


    // Generic Graph response → JSON parser that also surfaces HTTP-level failures.
    const parseGraphResponse = async (resp: Response) => {
      const raw = await resp.text();
      let json: any = null;
      try { json = raw ? JSON.parse(raw) : null; } catch { /* leave null */ }
      return { ok: resp.ok, status: resp.status, json, raw };
    };

    if (isVideo) {
      // Upload video using resumable upload
      console.log('Uploading video to Meta...');

      // Step 1: Initialize upload session
      const initResponse = await fetch(
        `https://graph.facebook.com/v25.0/act_${accountId}/advideos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            access_token: metaAccessToken,
            upload_phase: 'start',
            file_size: assetData.size.toString(),
          }),
        }
      );

      const init = await parseGraphResponse(initResponse);
      if (!init.ok || init.json?.error || !init.json?.upload_session_id) {
        console.error('Video upload init error:', { status: init.status, json: init.json, raw: init.raw?.slice(0, 500) });
        return new Response(
          JSON.stringify({
            success: false,
            error: friendlyMetaError(init.json?.error, `Meta wouldn't start the video upload (HTTP ${init.status}). Try a smaller MP4 (under 1GB, vertical 9:16).`),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { upload_session_id, video_id } = init.json;
      console.log('Video upload session started:', upload_session_id);

      // Step 2: Upload video data (single chunk)
      const formData = new FormData();
      formData.append('access_token', metaAccessToken);
      formData.append('upload_phase', 'transfer');
      formData.append('upload_session_id', upload_session_id);
      formData.append('start_offset', '0');
      formData.append('video_file_chunk', assetData, fileName || 'video.mp4');

      const transferResponse = await fetch(
        `https://graph.facebook.com/v25.0/act_${accountId}/advideos`,
        { method: 'POST', body: formData }
      );
      const transfer = await parseGraphResponse(transferResponse);
      if (!transfer.ok || transfer.json?.error) {
        console.error('Video transfer error:', { status: transfer.status, json: transfer.json, raw: transfer.raw?.slice(0, 500) });
        return new Response(
          JSON.stringify({
            success: false,
            error: friendlyMetaError(transfer.json?.error, `Meta rejected the video transfer (HTTP ${transfer.status}). Check that your file is MP4 / MOV, vertical 9:16, and under 1GB.`),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 3: Finish upload
      const finishResponse = await fetch(
        `https://graph.facebook.com/v25.0/act_${accountId}/advideos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            access_token: metaAccessToken,
            upload_phase: 'finish',
            upload_session_id: upload_session_id,
          }),
        }
      );
      const finish = await parseGraphResponse(finishResponse);
      if (!finish.ok || finish.json?.error || finish.json?.success === false) {
        console.error('Video finish error:', { status: finish.status, json: finish.json, raw: finish.raw?.slice(0, 500) });
        return new Response(
          JSON.stringify({
            success: false,
            error: friendlyMetaError(finish.json?.error, `Meta couldn't finalize the video (HTTP ${finish.status}). The file may be corrupted — try re-exporting it.`),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Video uploaded successfully:', video_id);

      return new Response(
        JSON.stringify({ success: true, assetId: video_id, assetType: 'video' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } else {
      // Upload image
      console.log('Uploading image to Meta...');

      const imageFormData = new FormData();
      imageFormData.append('access_token', metaAccessToken);
      imageFormData.append('filename', assetData, fileName || 'image.jpg');

      const imageResponse = await fetch(
        `https://graph.facebook.com/v25.0/act_${accountId}/adimages`,
        { method: 'POST', body: imageFormData }
      );

      const img = await parseGraphResponse(imageResponse);
      if (!img.ok || img.json?.error) {
        console.error('Image upload error:', { status: img.status, json: img.json, raw: img.raw?.slice(0, 500) });
        return new Response(
          JSON.stringify({
            success: false,
            error: friendlyMetaError(
              img.json?.error,
              `Meta rejected the image (HTTP ${img.status}). Use a JPG, PNG, WEBP, or GIF under 30MB.`,
            ),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageKey = Object.keys(img.json?.images || {})[0];
      const imageHash = img.json?.images?.[imageKey]?.hash;

      if (!imageHash) {
        console.error('Unexpected image response:', img.json);
        return new Response(
          JSON.stringify({ success: false, error: "Meta accepted the upload but didn't return an image ID. Try re-uploading the file." }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Image uploaded successfully:', imageHash);

      return new Response(
        JSON.stringify({ success: true, assetId: imageHash, assetType: 'image' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
