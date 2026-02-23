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

    // Fetch brand data
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('name, industry, target_audience, brand_voice, audience_psychology')
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

    // Build AI prompt
    const prompt = `You are a Meta Ads creative strategist. Analyze the following brand and their current ad performance to provide trend insights and recommendations.

Brand: ${brand.name}
Industry: ${brand.industry || 'Not specified'}
Target Audience: ${brand.target_audience || 'Not specified'}
Brand Voice: ${brand.brand_voice || 'Not specified'}
Audience Psychology: ${JSON.stringify(brand.audience_psychology || {})}

Current Live Creative Performance:
${JSON.stringify(topCreative?.map(c => c.performance_snapshot) || [], null, 2)}

Provide insights in the following areas:
1. What's working NOW - based on their current best-performing creative patterns
2. Industry trends - what formats, hooks, and visual styles are working for similar businesses right now
3. Specific recommendations - 3-5 actionable creative ideas tailored to their brand voice and audience

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
          { role: 'system', content: 'You are a Meta Ads creative strategist specializing in psychology-driven advertising for coaches, course creators, and service providers.' },
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
                      },
                      required: ['idea', 'format', 'hook_suggestion', 'psychology_trigger'],
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

    return new Response(JSON.stringify({ success: true, insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-trend-insights error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
