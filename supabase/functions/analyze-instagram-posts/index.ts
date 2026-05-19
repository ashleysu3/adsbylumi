import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface InstagramPost {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  engagement_score?: number;
  ai_recommendation?: string;
  is_recommended?: boolean;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, instagramAccountId, objective, audiencePsychology, simple } = await req.json();

    if (!brandId || !instagramAccountId) {
      return new Response(
        JSON.stringify({ error: 'Brand ID and Instagram account ID are required.', code: 'MISSING_PARAMS' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Meta access token from brand record (vault RPC has crypto permission issues)
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('meta_access_token, instagram_account_id, instagram_account_name, meta_account_id, page_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand?.meta_access_token) {
      return new Response(
        JSON.stringify({ error: 'Your Meta connection has expired. Please go to Meta Settings and reconnect your account.', code: 'TOKEN_MISSING' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = brand.meta_access_token;

    console.log('Fetching Instagram posts for account:', instagramAccountId);

    // Fetch recent posts from Instagram Graph API
    // For simple picker mode, avoid engagement fields to prevent unnecessary permission failures.
    const baseFields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const engagementFields = 'like_count,comments_count';
    const requestedFields = simple ? baseFields : `${baseFields},${engagementFields}`;

    const fetchPostsByFields = async (igId: string, fields: string) => {
      const postsUrl = `https://graph.facebook.com/v25.0/${igId}/media?fields=${fields}&limit=25&access_token=${accessToken}`;
      const response = await fetch(postsUrl);
      const data = await response.json();
      return { response, data };
    };

    // Helper to try fetching posts for a given IG account, with engagement field fallback
    const fetchPostsForAccount = async (igId: string) => {
      let result = await fetchPostsByFields(igId, requestedFields);
      if (!result.response.ok && result.data?.error?.code === 10 && !simple) {
        console.warn(`Retrying without engagement fields for ${igId}`);
        result = await fetchPostsByFields(igId, baseFields);
      }
      return result;
    };

    let activeIgId = instagramAccountId;
    let { response: postsResponse, data: postsData } = await fetchPostsForAccount(activeIgId);

    if (!postsResponse.ok) {
      console.error('Primary IG account failed, attempting page-scoped recovery:', postsData?.error);

      // CRITICAL: Only recover within this brand's own Facebook Page.
      // On agency accounts the user token can see many Pages — falling back
      // to /me/accounts can swap in another brand's Instagram account.
      const recovered = brand.page_id
        ? await tryRecoverInstagramAccountForPage({
            pageId: brand.page_id,
            failedIgId: activeIgId,
            accessToken,
            fetchPostsForAccount,
          })
        : null;

      if (recovered) {
        activeIgId = recovered.igId;
        postsResponse = recovered.response;
        postsData = recovered.data;
        console.log('Page-scoped recovery succeeded with IG account:', activeIgId);

        // Only persist if the recovered IG actually belongs to this brand's page
        await supabase
          .from('brands')
          .update({
            instagram_account_id: activeIgId,
            instagram_account_name: recovered.name || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', brandId);
      } else {
        console.warn('No page-scoped recovery available for brand', brandId, '— refusing cross-brand fallback');
      }
    }

    if (!postsResponse.ok) {
      console.error('Error fetching posts after recovery attempt:', postsData);
      const code = postsData?.error?.code;
      // Graceful degradation: return empty posts instead of error when permissions are missing
      if (code === 10) {
        console.warn('Instagram media access denied (Code 10) — returning empty posts for URL-based fallback');
        return new Response(
          JSON.stringify({ posts: [], fallbackMode: 'url_paste', message: 'Instagram post browsing is not available. Use the URL paste option to add posts.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const metaError = postsData?.error?.message || 'Failed to fetch Instagram posts';
      return new Response(
        JSON.stringify({ error: `Could not load posts: ${metaError}`, code: 'API_ERROR' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const posts: InstagramPost[] = postsData.data || [];
    console.log('Fetched posts:', posts.length);

    // Simple mode: return raw posts without AI analysis
    if (simple) {
      return new Response(
        JSON.stringify({ posts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Full AI analysis mode below (kept for future use) ---

    if (posts.length === 0) {
      const suggestions = await generateContentSuggestions(
        objective,
        audiencePsychology,
        supabaseUrl
      );
      
      return new Response(
        JSON.stringify({ 
          posts: [],
          contentSuggestions: suggestions,
          message: 'No posts found. Here are some content ideas to get started.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analyzedPosts = await analyzePostsWithAI(
      posts,
      objective,
      audiencePsychology,
      supabaseUrl
    );

    let filteredPosts = analyzedPosts;
    if (objective === 'video_views') {
      filteredPosts = analyzedPosts.filter(p => p.media_type === 'VIDEO');
      
      if (filteredPosts.length === 0) {
        const suggestions = await generateContentSuggestions(
          objective,
          audiencePsychology,
          supabaseUrl
        );
        
        return new Response(
          JSON.stringify({ 
            posts: analyzedPosts,
            contentSuggestions: suggestions,
            message: 'No video posts found. Here are some video content ideas.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    filteredPosts.sort((a, b) => {
      if (a.is_recommended && !b.is_recommended) return -1;
      if (!a.is_recommended && b.is_recommended) return 1;
      return (b.engagement_score || 0) - (a.engagement_score || 0);
    });

    const recommendedCount = filteredPosts.filter(p => p.is_recommended).length;
    let contentSuggestions: any[] = [];
    
    if (recommendedCount < 2) {
      contentSuggestions = await generateContentSuggestions(
        objective,
        audiencePsychology,
        supabaseUrl
      );
    }

    return new Response(
      JSON.stringify({ 
        posts: filteredPosts,
        contentSuggestions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in analyze-instagram-posts:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Something went wrong loading your posts. Please try again.', code: 'UNKNOWN_ERROR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ---------------------------------------------------------------------------
// Auto-recovery: discover alternative Instagram accounts and find one that
// grants media read access. This handles the case where the saved IG account
// ID is stale or belongs to an account that no longer grants permissions.
// ---------------------------------------------------------------------------

interface RecoveredAccount {
  igId: string;
  name: string | null;
  response: Response;
  data: any;
}

async function tryRecoverInstagramAccount({
  failedIgId,
  accessToken,
  metaAccountId,
  fetchPostsForAccount,
}: {
  failedIgId: string;
  accessToken: string;
  metaAccountId?: string | null;
  fetchPostsForAccount: (igId: string) => Promise<{ response: Response; data: any }>;
}): Promise<RecoveredAccount | null> {
  const candidates = await discoverInstagramCandidates(accessToken, metaAccountId);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    if (candidate.id === failedIgId) continue;

    try {
      const result = await fetchPostsForAccount(candidate.id);
      if (result.response.ok && !result.data?.error) {
        return {
          igId: candidate.id,
          name: candidate.name || candidate.username || null,
          response: result.response,
          data: result.data,
        };
      }
    } catch (err) {
      console.warn(`Recovery candidate ${candidate.id} failed:`, err);
    }
  }

  return null;
}

async function discoverInstagramCandidates(
  accessToken: string,
  metaAccountId?: string | null,
): Promise<Array<{ id: string; name?: string; username?: string; source: string }>> {
  const candidates: Array<{ id: string; name?: string; username?: string; source: string }> = [];
  const seen = new Set<string>();

  const add = (c: { id: string; name?: string; username?: string; source: string }) => {
    if (!c.id || seen.has(c.id)) return;
    seen.add(c.id);
    candidates.push(c);
  };

  // Source 1: Pages → instagram_business_account
  try {
    const pagesUrl = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,name,username}&access_token=${accessToken}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();
    if (pagesRes.ok && Array.isArray(pagesData.data)) {
      for (const page of pagesData.data) {
        if (page.instagram_business_account) {
          add({ ...page.instagram_business_account, source: 'page_field' });
        }
        // Source 2: Page edge /instagram_accounts (using page token)
        if (page.access_token) {
          try {
            const edgeUrl = `https://graph.facebook.com/v25.0/${page.id}/instagram_accounts?fields=id,username,name&access_token=${page.access_token}`;
            const edgeRes = await fetch(edgeUrl);
            const edgeData = await edgeRes.json();
            if (edgeRes.ok && Array.isArray(edgeData.data)) {
              for (const ig of edgeData.data) add({ ...ig, source: 'page_edge' });
            }
          } catch { /* non-fatal */ }
        }
      }
    }
  } catch (err) {
    console.warn('IG recovery: Pages discovery failed:', err);
  }

  // Source 3: Ad account /instagram_accounts
  if (metaAccountId) {
    const actId = metaAccountId.startsWith('act_') ? metaAccountId : `act_${metaAccountId}`;
    try {
      const adIgUrl = `https://graph.facebook.com/v25.0/${actId}/instagram_accounts?fields=id,username,name&access_token=${accessToken}`;
      const adIgRes = await fetch(adIgUrl);
      const adIgData = await adIgRes.json();
      if (adIgRes.ok && Array.isArray(adIgData.data)) {
        for (const ig of adIgData.data) add({ ...ig, source: 'ad_account' });
      }
    } catch (err) {
      console.warn('IG recovery: Ad account discovery failed:', err);
    }
  }

  return candidates;
}

async function analyzePostsWithAI(
  posts: InstagramPost[],
  objective: string,
  audiencePsychology: any,
  supabaseUrl: string
): Promise<InstagramPost[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    // Fall back to basic engagement scoring
    return posts.map(post => ({
      ...post,
      engagement_score: (post.like_count || 0) + (post.comments_count || 0) * 3,
      is_recommended: (post.like_count || 0) > 50 || (post.comments_count || 0) > 5,
    }));
  }

  try {
    // Prepare post summaries for AI analysis
    const postSummaries = posts.map(p => ({
      id: p.id,
      type: p.media_type,
      caption: (p.caption || '').substring(0, 200),
      likes: p.like_count,
      comments: p.comments_count,
    }));

    const audienceDescription = audiencePsychology 
      ? `Target audience: ${JSON.stringify(audiencePsychology).substring(0, 500)}`
      : 'General audience';

    const prompt = `Analyze these Instagram posts and identify which ones would work best for a ${objective === 'video_views' ? 'video views' : 'profile traffic'} ad campaign.

${audienceDescription}

Posts to analyze:
${JSON.stringify(postSummaries, null, 2)}

For each post, return:
1. Whether it's recommended (true/false)
2. A brief reason why or why not

Respond in JSON format:
{
  "analysis": [
    { "id": "post_id", "recommended": true, "reason": "Strong hook and high engagement" }
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert social media strategist who analyzes content for ad performance potential.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('AI analysis failed, falling back to basic scoring');
      return posts.map(post => ({
        ...post,
        engagement_score: (post.like_count || 0) + (post.comments_count || 0) * 3,
        is_recommended: (post.like_count || 0) > 50 || (post.comments_count || 0) > 5,
      }));
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Parse AI response
    let analysis: any[] = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysis = parsed.analysis || [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    // Merge AI analysis with posts
    return posts.map(post => {
      const aiResult = analysis.find((a: any) => a.id === post.id);
      const engagementScore = (post.like_count || 0) + (post.comments_count || 0) * 3;
      
      return {
        ...post,
        engagement_score: engagementScore,
        is_recommended: aiResult?.recommended ?? (engagementScore > 100),
        ai_recommendation: aiResult?.reason,
      };
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    // Fall back to basic scoring
    return posts.map(post => ({
      ...post,
      engagement_score: (post.like_count || 0) + (post.comments_count || 0) * 3,
      is_recommended: (post.like_count || 0) > 50 || (post.comments_count || 0) > 5,
    }));
  }
}

async function generateContentSuggestions(
  objective: string,
  audiencePsychology: any,
  supabaseUrl: string
): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const fallbackSuggestions = objective === 'video_views' ? [
    {
      title: "Behind the Scenes",
      description: "Show the human side of your brand - your workspace, process, or team. Authenticity builds connection.",
      hook: "Here's what goes into every...",
      format: "video",
      psychologyTrigger: "Authenticity & Trust",
    },
    {
      title: "Quick Tip Tutorial",
      description: "Share a valuable 30-second tip related to your expertise. Position yourself as the go-to authority.",
      hook: "The #1 mistake I see...",
      format: "video",
      psychologyTrigger: "Authority & Value",
    },
    {
      title: "Transformation Story",
      description: "Share a before/after or client success story that showcases the results you deliver.",
      hook: "From struggling with X to...",
      format: "video",
      psychologyTrigger: "Social Proof",
    },
  ] : [
    {
      title: "Value-First Carousel",
      description: "Create a 5-slide carousel teaching something actionable. End with a soft CTA to follow for more.",
      hook: "5 things I wish I knew...",
      format: "carousel",
      psychologyTrigger: "Reciprocity",
    },
    {
      title: "Hot Take / Opinion",
      description: "Share a bold perspective that challenges common beliefs in your industry.",
      hook: "Unpopular opinion: ...",
      format: "image",
      psychologyTrigger: "Controversy & Curiosity",
    },
    {
      title: "Personal Story Post",
      description: "Share your origin story or a pivotal moment. People follow people, not businesses.",
      hook: "Nobody knows this, but...",
      format: "image",
      psychologyTrigger: "Connection & Relatability",
    },
  ];

  if (!LOVABLE_API_KEY) {
    return fallbackSuggestions;
  }

  try {
    const audienceDescription = audiencePsychology 
      ? `Target audience psychology: ${JSON.stringify(audiencePsychology).substring(0, 500)}`
      : '';

    const prompt = `Generate 4 Instagram content ideas that would attract and convert followers for a brand.

Campaign objective: ${objective === 'video_views' ? 'Video Views (Reels)' : 'Profile Traffic'}
${audienceDescription}

For each idea, provide:
1. A catchy title
2. A brief description of the content
3. A strong hook/opening line
4. The best format (video, image, or carousel)
5. The psychological trigger it uses

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "...",
      "description": "...",
      "hook": "...",
      "format": "video|image|carousel",
      "psychologyTrigger": "..."
    }
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert social media content strategist who creates viral content ideas.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return fallbackSuggestions;
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.suggestions || fallbackSuggestions;
      }
    } catch (parseError) {
      console.error('Failed to parse suggestions:', parseError);
    }

    return fallbackSuggestions;
  } catch (error) {
    console.error('Content suggestion generation error:', error);
    return fallbackSuggestions;
  }
}
