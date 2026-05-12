import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId } = await req.json();
    if (!brandId) {
      return new Response(JSON.stringify({ error: 'brandId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch brand data including Meta credentials
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('name, industry, target_audience, brand_voice, audience_psychology, meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch top-performing creative bench items
    const { data: topCreative } = await supabaseAdmin
      .from('creative_bench')
      .select('performance_snapshot, production_item_id, status')
      .eq('brand_id', brandId)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(10);

    // ---------- Fetch REAL ad-level insights from Meta API ----------
    let metaAdData: any[] = [];
    let metaDataAvailable = false;

    if (brand.meta_account_id && brand.meta_access_token) {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const sinceStr = since.toISOString().split('T')[0];
        const untilStr = new Date().toISOString().split('T')[0];

        const fields = 'ad_name,spend,impressions,clicks,ctr,actions,cost_per_action_type,purchase_roas,reach';
        const actId = brand.meta_account_id.startsWith('act_') ? brand.meta_account_id : `act_${brand.meta_account_id}`;
        const metaUrl = `https://graph.facebook.com/v25.0/${actId}/insights?fields=${fields}&time_range={"since":"${sinceStr}","until":"${untilStr}"}&level=ad&limit=100&filtering=[{"field":"spend","operator":"GREATER_THAN","value":"10"}]&access_token=${brand.meta_access_token}`;

        console.log('[generate-trend-insights] Fetching Meta ad-level insights...');
        const metaRes = await fetch(metaUrl);

        if (metaRes.ok) {
          const metaJson = await metaRes.json();
          const ads = metaJson.data || [];

          // Filter to ads with meaningful reach (>= 500)
          const significantAds = ads.filter((ad: any) => parseInt(ad.reach || '0') >= 500);

          metaAdData = significantAds.map((ad: any) => {
            const spend = parseFloat(ad.spend || '0');
            const clicks = parseInt(ad.clicks || '0');
            const ctr = parseFloat(ad.ctr || '0');
            const reach = parseInt(ad.reach || '0');
            const impressions = parseInt(ad.impressions || '0');

            // Extract conversion actions
            const leadAction = ad.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_lead');
            const purchaseAction = ad.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase');
            const linkClickAction = ad.actions?.find((a: any) => a.action_type === 'link_click');
            const leads = leadAction ? parseInt(leadAction.value || '0') : 0;
            const purchases = purchaseAction ? parseInt(purchaseAction.value || '0') : 0;
            const linkClicks = linkClickAction ? parseInt(linkClickAction.value || '0') : 0;

            // CPA
            const leadCPA = ad.cost_per_action_type?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_lead');
            const purchaseCPA = ad.cost_per_action_type?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase');
            const cpl = leadCPA ? parseFloat(leadCPA.value || '0') : 0;
            const cpp = purchaseCPA ? parseFloat(purchaseCPA.value || '0') : 0;

            // ROAS
            const roasObj = ad.purchase_roas?.[0];
            const roas = roasObj ? parseFloat(roasObj.value || '0') : 0;

            return {
              ad_name: ad.ad_name,
              spend: Math.round(spend * 100) / 100,
              clicks,
              ctr: Math.round(ctr * 100) / 100,
              reach,
              impressions,
              leads,
              purchases,
              link_clicks: linkClicks,
              cpl: Math.round(cpl * 100) / 100,
              cpp: Math.round(cpp * 100) / 100,
              roas: Math.round(roas * 100) / 100,
            };
          });

          // Sort by spend descending to prioritize higher-spend ads
          metaAdData.sort((a: any, b: any) => b.spend - a.spend);
          metaDataAvailable = metaAdData.length > 0;

          console.log(`[generate-trend-insights] Fetched ${metaAdData.length} significant ads from Meta`);
        } else {
          console.error('[generate-trend-insights] Meta API error:', metaRes.status);
        }
      } catch (metaErr) {
        console.error('[generate-trend-insights] Meta fetch error:', metaErr);
      }
    }

    // ---------- Build enhanced AI prompt ----------
    const metaDataSection = metaDataAvailable
      ? `
REAL AD-LEVEL PERFORMANCE DATA (last 90 days, sorted by spend):
${JSON.stringify(metaAdData.slice(0, 25), null, 2)}

Total ads analyzed: ${metaAdData.length}
Total spend: $${metaAdData.reduce((sum: number, a: any) => sum + a.spend, 0).toFixed(2)}

IMPORTANT: Use ad names to infer creative format types. Common patterns:
- "TH" or "talking head" = talking head video
- "GFX" or "graphic" or "static" = static graphic/image
- "UGC" = user-generated content
- "carousel" = carousel ad
- Names with personal names often indicate talking head videos
- Look for hook patterns in the ad names (e.g., "Hook1", "V1", "Angle")
`
      : '';

    const benchDataSection = topCreative && topCreative.length > 0
      ? `\nCreative Bench Data (currently live):\n${JSON.stringify(topCreative.map(c => c.performance_snapshot).filter(Boolean), null, 2)}`
      : '';

    const prompt = `You are a Meta Ads creative strategist who specializes in psychology-driven advertising for coaches, course creators, and service providers.

Analyze the following brand data and their ad performance to provide deep creative insights and actionable recommendations.

Brand: ${brand.name}
Industry: ${brand.industry || 'Not specified'}
Target Audience: ${brand.target_audience || 'Not specified'}
Brand Voice: ${brand.brand_voice || 'Not specified'}
Audience Psychology: ${JSON.stringify(brand.audience_psychology || {})}
${metaDataSection}${benchDataSection}

${metaDataAvailable ? `
ANALYSIS REQUIREMENTS:
1. Look at ALL ads across ALL campaigns — identify cross-campaign patterns (e.g., "talking head videos outperform graphics regardless of campaign objective")
2. Identify which FORMATS consistently perform best (talking head, static, carousel, UGC, etc.)
3. Find HOOKS and MESSAGING PATTERNS that appear in top-performing ads
4. Identify what specifically does NOT work and WHY
5. Connect patterns to the audience psychology — why does this audience respond to these formats/messages?
6. Provide specific, actionable recommendations for new creative that incorporates these learnings

For each recommendation, include:
- A specific creative idea
- The format it should be (talking_head, static, carousel, ugc, graphic)
- A specific hook suggestion
- The psychology trigger that makes it work
- Production guidance (how to actually create it)
- Why it works (psychology explanation)
- Which top performer inspired this recommendation
` : `
Since there's no live ad data available, provide:
1. Industry trend analysis for ${brand.industry || 'coaching/course'} businesses
2. Psychology-driven creative recommendations based on the audience profile
3. Best practice format suggestions for their niche
`}

Return your response as a JSON object using the suggest_trends tool.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a Meta Ads creative strategist specializing in psychology-driven advertising for coaches, course creators, and service providers. You analyze real performance data to find actionable patterns.' },
          { role: 'user', content: prompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_trends',
              description: 'Return structured trend insights for the brand',
              parameters: {
                type: 'object',
                properties: {
                  whats_working: {
                    type: 'object',
                    properties: {
                      summary: { type: 'string' },
                      top_patterns: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            pattern: { type: 'string' },
                            why_it_works: { type: 'string' },
                          },
                          required: ['pattern', 'why_it_works'],
                        },
                      },
                    },
                    required: ['summary', 'top_patterns'],
                  },
                  industry_trends: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        trend: { type: 'string' },
                        description: { type: 'string' },
                        relevance: { type: 'string', enum: ['high', 'medium', 'low'] },
                      },
                      required: ['trend', 'description', 'relevance'],
                    },
                  },
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        idea: { type: 'string' },
                        format: { type: 'string' },
                        hook_suggestion: { type: 'string' },
                        psychology_trigger: { type: 'string' },
                        guidance: { type: 'string' },
                        why_it_works: { type: 'string' },
                        based_on: { type: 'string' },
                      },
                      required: ['idea', 'format', 'hook_suggestion', 'psychology_trigger', 'guidance', 'why_it_works', 'based_on'],
                    },
                  },
                },
                required: ['whats_working', 'industry_trends', 'recommendations'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_trends' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error('No tool call response from AI');
    }

    const insights = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ 
      success: true, 
      insights,
      metaDataAvailable,
      adsAnalyzed: metaAdData.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-trend-insights error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
