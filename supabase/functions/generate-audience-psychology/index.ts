import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let parsedBrandId: string | null = null;

  try {
    const body = await req.json();
    const { brandId } = body;

    // Input validation
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidUUID(brandId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid brandId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    parsedBrandId = brandId;
    console.log('Generating audience psychology for brand:', brandId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Required environment variables are not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify brand exists before proceeding
    const { data: brandCheck, error: checkError } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .single();

    if (checkError || !brandCheck) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to generating
    await supabase
      .from('brands')
      .update({ psychology_status: 'generating' })
      .eq('id', brandId);

    // Fetch brand data
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();

    if (brandError) throw brandError;

    const systemPrompt = `You are an expert in audience psychology and advertising strategy, trained in the "After Organic" methodology.
Your task is to create a comprehensive psychological profile of the target audience based on brand information.

Analyze the brand's value proposition, target audience, and industry to generate:
1. Demographics - Age range, income level, occupation, location patterns
2. Psychographics - Values, lifestyle, aspirations, beliefs, identity
3. Pain Points - Specific problems, frustrations, struggles (array of 5-8 items)
4. Desires - Deep wants, outcomes they're seeking (array of 5-8 items)
5. Objections - Reasons they might not buy, hesitations, doubts (array of 5-8 items)
6. Motivations - Core drivers, what moves them to action

Return ONLY a valid JSON object with these exact fields:
{
  "demographics": "string",
  "psychographics": "string",
  "pain_points": ["string"],
  "desires": ["string"],
  "objections": ["string"],
  "motivations": "string"
}

Be specific and psychology-driven. Use language that resonates with the After Organic tone: warm, clever, strategic.`;

    const userPrompt = `Create a psychological profile for this audience:

Brand: ${brand.name}
What they offer: ${brand.value_proposition || 'Not specified'}
Who they serve: ${brand.target_audience || 'Not specified'}
Industry: ${brand.industry || 'Not specified'}

Generate a deep, actionable psychological profile.`;

    console.log('Calling Lovable AI for psychology generation...');
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
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      await supabase
        .from('brands')
        .update({ psychology_status: 'error' })
        .eq('id', brandId);
      
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    const psychology = JSON.parse(content);

    // Update brand with psychology data
    const { error: updateError } = await supabase
      .from('brands')
      .update({
        audience_psychology: psychology,
        psychology_status: 'completed'
      })
      .eq('id', brandId);

    if (updateError) throw updateError;

    console.log('Audience psychology generated and saved successfully');

    return new Response(JSON.stringify({ success: true, psychology }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-audience-psychology:', error);
    
    // Try to update status to error if we have brandId
    if (parsedBrandId) {
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from('brands')
            .update({ psychology_status: 'error' })
            .eq('id', parsedBrandId);
        }
      } catch (e) {
        console.error('Failed to update error status:', e);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate psychology' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
