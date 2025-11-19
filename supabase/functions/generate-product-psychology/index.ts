import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerId, brandId } = await req.json();
    console.log('Generating product psychology for offer:', offerId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Required environment variables are not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch offer and brand data
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (offerError) throw offerError;

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();

    if (brandError) throw brandError;

    const systemPrompt = `You are an expert in product positioning and buyer psychology.
Your task is to create a product-specific psychological profile that combines the general audience psychology with this specific offer.

Analyze the offer details and the brand's audience psychology to generate:
1. Product Positioning - How this specific product fits the audience's needs
2. Specific Pain Points - Problems this exact product solves (array of 4-6 items)
3. Specific Desires - Outcomes this exact product delivers (array of 4-6 items)
4. Product Objections - Specific hesitations about THIS product (array of 4-6 items)
5. Buying Triggers - What would make them buy THIS product specifically

Return ONLY a valid JSON object with these exact fields:
{
  "positioning": "string",
  "product_pain_points": ["string"],
  "product_desires": ["string"],
  "product_objections": ["string"],
  "buying_triggers": "string"
}

Be specific to this exact product and price point. Consider how it fits the broader audience psychology.`;

    const audiencePsych = brand.audience_psychology || {};
    
    const userPrompt = `Create a product-specific psychological profile:

OFFER DETAILS:
- Name: ${offer.name}
- Description: ${offer.description || 'Not specified'}
- Price: ${offer.price_point || 'Not specified'}
- Target Outcome: ${offer.target_outcome || 'Not specified'}

AUDIENCE PSYCHOLOGY:
- General Pain Points: ${JSON.stringify(audiencePsych.pain_points || [])}
- General Desires: ${JSON.stringify(audiencePsych.desires || [])}
- General Objections: ${JSON.stringify(audiencePsych.objections || [])}
- Demographics: ${audiencePsych.demographics || 'Not specified'}

Generate a product-specific psychological profile.`;

    console.log('Calling Lovable AI for product psychology...');
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
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    const productPsychology = JSON.parse(content);

    // Update offer with product psychology
    const { error: updateError } = await supabase
      .from('offers')
      .update({ product_psychology: productPsychology })
      .eq('id', offerId);

    if (updateError) throw updateError;

    console.log('Product psychology generated and saved successfully');

    return new Response(JSON.stringify({ success: true, productPsychology }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-product-psychology:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate product psychology' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
