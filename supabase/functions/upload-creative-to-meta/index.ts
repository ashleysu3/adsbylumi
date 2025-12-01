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
    const { assetUrl, assetStoragePath, metaAccountId, metaAccessToken, fileName } = await req.json();

    if (!metaAccountId || !metaAccessToken) {
      throw new Error('Meta account ID and access token are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        throw new Error(`Failed to download asset: ${downloadError.message}`);
      }

      assetData = downloadData;
      contentType = downloadData.type;
    } else if (assetUrl) {
      // If we have a URL, fetch it directly
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch asset from URL: ${response.statusText}`);
      }
      assetData = await response.blob();
      contentType = response.headers.get('content-type') || 'application/octet-stream';
    } else {
      throw new Error('Either assetUrl or assetStoragePath is required');
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
        `https://graph.facebook.com/v18.0/act_${accountId}/advideos`,
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
        throw new Error(initData.error.message || 'Failed to initialize video upload');
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
        `https://graph.facebook.com/v18.0/act_${accountId}/advideos`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const transferData = await transferResponse.json();
      
      if (transferData.error) {
        console.error('Video transfer error:', transferData.error);
        throw new Error(transferData.error.message || 'Failed to transfer video');
      }

      // Step 3: Finish upload
      const finishResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/advideos`,
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
        throw new Error(finishData.error.message || 'Failed to finish video upload');
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
        `https://graph.facebook.com/v18.0/act_${accountId}/adimages`,
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
        throw new Error(imageData.error.message || 'Failed to upload image');
      }

      // Extract hash from response - response format is { images: { bytes: { hash: "...", url: "..." } } }
      const imageKey = Object.keys(imageData.images || {})[0];
      const imageHash = imageData.images?.[imageKey]?.hash;

      if (!imageHash) {
        console.error('Unexpected image response:', imageData);
        throw new Error('Failed to get image hash from Meta response');
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
