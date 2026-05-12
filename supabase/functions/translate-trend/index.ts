import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function scrapeContent(url: string): Promise<{ caption: string; description: string; thumbnailUrl: string | null; platform: string }> {
  let caption = '';
  let description = '';
  let thumbnailUrl: string | null = null;
  let platform = 'unknown';

  if (url.includes('instagram.com')) platform = 'instagram';
  else if (url.includes('tiktok.com')) platform = 'tiktok';
  else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
  else if (url.includes('facebook.com') || url.includes('fb.watch')) platform = 'facebook';

  // Strategy 1: oEmbed
  try {
    let oembedUrl = '';
    if (platform === 'instagram') {
      oembedUrl = `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=public`;
    } else if (platform === 'tiktok') {
      oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    }
    if (oembedUrl) {
      const resp = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        caption = data.title || data.author_name || '';
        thumbnailUrl = data.thumbnail_url || null;
        if (caption) return { caption, description, thumbnailUrl, platform };
      }
    }
  } catch { /* continue */ }

  // Strategy 2: Direct fetch + meta tags
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const html = await resp.text();
      const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

      caption = ogTitle?.[1] || '';
      description = ogDesc?.[1] || metaDesc?.[1] || '';
      thumbnailUrl = thumbnailUrl || ogImage?.[1] || null;
    }
  } catch { /* continue */ }

  return { caption, description, thumbnailUrl, platform };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, offerId, url, trendDescription } = await req.json();

    if (!brandId) {
      return new Response(JSON.stringify({ error: 'Missing brandId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!url && !trendDescription) {
      return new Response(JSON.stringify({ error: 'Provide a URL or trend description' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch brand data
    const { data: brand } = await supabase
      .from('brands')
      .select('name, industry, brand_voice, target_audience, audience_psychology, value_proposition, copy_perspective, use_emojis, brand_emojis, bullet_emoji, never_use_words')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch offer data if provided
    let offer: any = null;
    if (offerId) {
      const { data } = await supabase
        .from('offers')
        .select('name, description, price_point, target_outcome, url, product_psychology, offer_audience_psychology')
        .eq('id', offerId)
        .single();
      offer = data;
    }

    // Fetch content assets for richer context
    const { data: contentAssets } = await supabase
      .from('brand_content_assets')
      .select('asset_type, content, label')
      .eq('brand_id', brandId)
      .limit(10);

    // Scrape trend content if URL provided
    let scrapedContent = { caption: '', description: '', thumbnailUrl: null as string | null, platform: 'unknown' };
    if (url) {
      scrapedContent = await scrapeContent(url);
    }

    const trendContext = url
      ? `TREND SOURCE: ${url}\nPlatform: ${scrapedContent.platform}\nCaption/Title: ${scrapedContent.caption || 'Could not extract'}\nDescription: ${scrapedContent.description || 'Could not extract'}\n\nIMPORTANT: Even if the scraped content is limited, analyze the URL pattern and platform to infer what type of content this is (Reel, TikTok, carousel, etc.) and provide useful translation guidance.`
      : `TREND DESCRIPTION (user-provided): ${trendDescription}`;

    const brandContext = `
BRAND: ${brand.name}
INDUSTRY: ${brand.industry || 'Not specified'}
BRAND VOICE: ${brand.brand_voice || 'Not specified'}
TARGET AUDIENCE: ${brand.target_audience || 'Not specified'}
VALUE PROPOSITION: ${brand.value_proposition || 'Not specified'}
COPY PERSPECTIVE: ${brand.copy_perspective || 'I'}
${brand.never_use_words?.length ? `NEVER USE THESE WORDS: ${brand.never_use_words.join(', ')}` : ''}
${brand.audience_psychology ? `AUDIENCE PSYCHOLOGY: ${JSON.stringify(brand.audience_psychology)}` : ''}`;

    const offerContext = offer ? `
OFFER: ${offer.name}
DESCRIPTION: ${offer.description || 'Not specified'}
PRICE: ${offer.price_point || 'Not specified'}
TARGET OUTCOME: ${offer.target_outcome || 'Not specified'}
OFFER URL: ${offer.url || 'Not specified'}
${offer.product_psychology ? `PRODUCT PSYCHOLOGY: ${JSON.stringify(offer.product_psychology)}` : ''}
${offer.offer_audience_psychology ? `OFFER AUDIENCE PSYCHOLOGY: ${JSON.stringify(offer.offer_audience_psychology)}` : ''}` : '';

    const assetsContext = contentAssets?.length
      ? `\nCONTENT ASSETS (testimonials, scripts, etc.):\n${contentAssets.map(a => `- [${a.asset_type}] ${a.label || ''}: ${a.content.slice(0, 200)}`).join('\n')}`
      : '';

    const systemPrompt = `You are LUMI, the AI creative strategist for Your Ad Assistant. You translate trending social media content into brand-specific ad concepts.

Your job: Take a trending piece of content and translate it so this specific brand can use the same format, energy, and psychology — but for THEIR audience and THEIR offer.

${brandContext}
${offerContext}
${assetsContext}

RULES:
- Write in the brand's voice and copy perspective (${brand.copy_perspective}-statements)
- Use the audience's actual pain points, desires, and language from the psychology profiles
- Make hooks specific to the brand's niche — no generic marketing speak
- ${brand.use_emojis ? `Use emojis naturally (brand emojis: ${brand.brand_emojis?.join(' ')})` : 'Do NOT use emojis'}
- Every hook and caption must feel like the brand's audience wrote it, not a marketer
- Reference the offer naturally when applicable
- Scripts should be first-person, diary-like, and emotionally specific`;

    const userPrompt = `${trendContext}

Analyze this trend and translate it for my brand. Return a complete translation using the translate_trend function.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'translate_trend',
            description: 'Return the complete trend translation with all sections.',
            parameters: {
              type: 'object',
              properties: {
                whyItWorks: {
                  type: 'object',
                  properties: {
                    psychologyDriver: { type: 'string', description: 'The core psychological principle making this trend effective (e.g., social proof, curiosity gap, pattern interrupt)' },
                    engagementMechanism: { type: 'string', description: 'Why people stop scrolling and engage with this format' },
                    platformContext: { type: 'string', description: 'How this trend fits the platform algorithm and user behavior patterns' },
                  },
                  required: ['psychologyDriver', 'engagementMechanism', 'platformContext'],
                },
                formatBlueprint: {
                  type: 'object',
                  properties: {
                    structure: { type: 'string', description: 'Step-by-step structure of the content format (e.g., Hook → Reveal → CTA)' },
                    duration: { type: 'string', description: 'Recommended length (e.g., 15-30 seconds)' },
                    style: { type: 'string', description: 'Visual/editing style notes (e.g., talking head, text overlay, transitions)' },
                    brandAdaptation: { type: 'string', description: 'How to adapt this format specifically for this brand and offer' },
                  },
                  required: ['structure', 'duration', 'style', 'brandAdaptation'],
                },
                hookVariations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      hook: { type: 'string', description: 'The hook text, written in the brand voice for their specific audience' },
                      angle: { type: 'string', description: 'Short label for the angle (e.g., Pain Point, Curiosity, Social Proof)' },
                      whyItWorks: { type: 'string', description: 'Brief explanation of why this hook works for this audience' },
                    },
                    required: ['hook', 'angle', 'whyItWorks'],
                  },
                  description: '4-5 hook variations tailored to this brand',
                },
                filmingTips: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '4-6 practical filming/production tips for recreating this trend',
                },
                caption: {
                  type: 'string',
                  description: 'A ready-to-post caption written in the brand voice, including CTA',
                },
                adConcept: {
                  type: 'object',
                  properties: {
                    headline: { type: 'string', description: 'Ad headline under 26 characters' },
                    primaryText: { type: 'string', description: 'Primary ad copy (medium length) written in brand voice' },
                    description: { type: 'string', description: 'Ad description line' },
                    cta: { type: 'string', description: 'Call to action button text' },
                    script: { type: 'string', description: 'Full 30-second talking-head script using this trend format, first-person, diary-like' },
                  },
                  required: ['headline', 'primaryText', 'description', 'cta', 'script'],
                },
                trendSummary: { type: 'string', description: 'One-line summary of the original trend for display purposes' },
              },
              required: ['whyItWorks', 'formatBlueprint', 'hookVariations', 'filmingTips', 'caption', 'adConcept', 'trendSummary'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'translate_trend' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits in Settings.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error('No tool call in response:', JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: 'AI did not return structured output' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Failed to parse tool call arguments:', toolCall.function.arguments);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: result,
      scraped: {
        platform: scrapedContent.platform,
        caption: scrapedContent.caption,
        thumbnailUrl: scrapedContent.thumbnailUrl,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('translate-trend error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
