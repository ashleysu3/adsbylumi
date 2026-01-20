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
    const { brandId, instagramAccountId, objective, audiencePsychology } = await req.json();

    if (!brandId || !instagramAccountId) {
      throw new Error('brandId and instagramAccountId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Meta access token from vault
    const { data: accessToken, error: tokenError } = await supabase
      .rpc('get_meta_token', { p_brand_id: brandId });

    if (tokenError || !accessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    console.log('Fetching Instagram posts for account:', instagramAccountId);

    // Fetch recent posts from Instagram Graph API
    const postsUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${accessToken}`;
    
    const postsResponse = await fetch(postsUrl);
    const postsData = await postsResponse.json();

    if (!postsResponse.ok) {
      console.error('Error fetching posts:', postsData);
      throw new Error(postsData.error?.message || 'Failed to fetch Instagram posts');
    }

    const posts: InstagramPost[] = postsData.data || [];
    console.log('Fetched posts:', posts.length);

    if (posts.length === 0) {
      // No posts found - return empty with content suggestions
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

    // Calculate engagement scores and analyze posts
    const analyzedPosts = await analyzePostsWithAI(
      posts,
      objective,
      audiencePsychology,
      supabaseUrl
    );

    // Filter for video posts if objective is video_views
    let filteredPosts = analyzedPosts;
    if (objective === 'video_views') {
      filteredPosts = analyzedPosts.filter(p => p.media_type === 'VIDEO');
      
      if (filteredPosts.length === 0) {
        // No videos - return content suggestions for video content
        const suggestions = await generateContentSuggestions(
          objective,
          audiencePsychology,
          supabaseUrl
        );
        
        return new Response(
          JSON.stringify({ 
            posts: analyzedPosts, // Return all posts but no recommendations
            contentSuggestions: suggestions,
            message: 'No video posts found. Here are some video content ideas.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Sort by engagement and recommendation
    filteredPosts.sort((a, b) => {
      if (a.is_recommended && !b.is_recommended) return -1;
      if (!a.is_recommended && b.is_recommended) return 1;
      return (b.engagement_score || 0) - (a.engagement_score || 0);
    });

    // Check if we have enough good content
    const recommendedCount = filteredPosts.filter(p => p.is_recommended).length;
    let contentSuggestions: any[] = [];
    
    if (recommendedCount < 2) {
      // Not enough good content - include suggestions
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
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
