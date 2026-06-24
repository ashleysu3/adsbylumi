import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface PagePost {
  id: string;
  facebook_post_id: string;
  caption: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  thumbnail_url?: string;
  permalink: string;
  created_time?: string;
  like_count?: number;
  comments_count?: number;
  share_count?: number;
  platform: 'facebook';
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { brandId } = await req.json();
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId is required', posts: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: brand, error: brandErr } = await supabase
      .from('brands')
      .select('meta_access_token, page_id')
      .eq('id', brandId)
      .maybeSingle();

    if (brandErr || !brand?.meta_access_token || !brand?.page_id) {
      return new Response(
        JSON.stringify({
          error: 'No Facebook Page connected to this brand. Connect a Page in Meta Settings.',
          posts: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = brand.meta_access_token;
    const pageId = brand.page_id;

    // Get a Page Access Token (required for pages_read_engagement on published_posts)
    let pageToken = accessToken;
    try {
      const r = await fetch(
        `https://graph.facebook.com/v25.0/${pageId}?fields=access_token&access_token=${accessToken}`
      );
      const j = await r.json();
      if (r.ok && j.access_token) pageToken = j.access_token;
    } catch (_e) { /* fall back to user token */ }

    const fields = [
      'id',
      'message',
      'created_time',
      'permalink_url',
      'full_picture',
      'attachments{media_type,media,subattachments}',
      'reactions.summary(total_count).limit(0)',
      'comments.summary(total_count).limit(0)',
      'shares',
    ].join(',');

    const url = `https://graph.facebook.com/v25.0/${pageId}/published_posts?fields=${fields}&limit=25&access_token=${pageToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      console.error('[list-facebook-page-posts] Graph error:', data?.error);
      return new Response(
        JSON.stringify({
          error: data?.error?.message || 'Could not load Page posts.',
          code: data?.error?.code || null,
          posts: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const raw: any[] = data?.data || [];
    const posts: PagePost[] = raw.map((p) => {
      const att = p.attachments?.data?.[0];
      const mt = (att?.media_type || '').toLowerCase();
      const hasSub = Array.isArray(att?.subattachments?.data) && att.subattachments.data.length > 1;
      const media_type: PagePost['media_type'] = hasSub
        ? 'CAROUSEL_ALBUM'
        : mt.includes('video')
          ? 'VIDEO'
          : 'IMAGE';
      const thumb =
        p.full_picture ||
        att?.media?.image?.src ||
        att?.subattachments?.data?.[0]?.media?.image?.src;

      return {
        id: p.id,
        facebook_post_id: p.id,
        caption: p.message || '',
        media_type,
        thumbnail_url: thumb,
        permalink: p.permalink_url || `https://www.facebook.com/${p.id}`,
        created_time: p.created_time,
        like_count: p.reactions?.summary?.total_count ?? undefined,
        comments_count: p.comments?.summary?.total_count ?? undefined,
        share_count: p.shares?.count ?? undefined,
        platform: 'facebook',
      };
    });

    // Most recent first (the API returns this order already, but be defensive)
    posts.sort((a, b) => {
      const at = a.created_time ? Date.parse(a.created_time) : 0;
      const bt = b.created_time ? Date.parse(b.created_time) : 0;
      return bt - at;
    });

    return new Response(
      JSON.stringify({ posts, pageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[list-facebook-page-posts] Error:', e);
    return new Response(
      JSON.stringify({ error: e?.message || 'Unknown error', posts: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
