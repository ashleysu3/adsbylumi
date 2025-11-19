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
    const { offerId } = await req.json();
    console.log('Recommending campaign template for offer:', offerId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Required environment variables are not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch offer data
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (offerError) throw offerError;

    // Fetch all active campaign templates
    const { data: templates, error: templatesError } = await supabase
      .from('campaign_templates')
      .select('*')
      .eq('active', true);

    if (templatesError) throw templatesError;

    const systemPrompt = `You are a Meta Ads strategist expert. Analyze an offer and recommend the BEST campaign template.

MATCHING RULES:
- Free/$0-20 offers → "Lead Magnet Downloads" or "Webinar Sign Ups"
- $20-$50 offers → "Low Ticket Product Sales"
- $100+ or 'call' in outcome → "Discovery Call / Application"
- If target_outcome contains 'webinar'/'training' → "Webinar Sign Ups"
- If outcome is 'visibility'/'followers' → "Traffic to Instagram/Facebook"
- If outcome is 'trust'/'awareness' → "Video Views Campaign"

Return ONLY a valid JSON object:
{
  "recommended_template_slug": "string",
  "confidence": "high|medium|low",
  "reason": "2-3 sentence explanation focused on why this template fits this specific offer"
}`;

    const templatesInfo = templates.map(t => `
Slug: ${t.slug}
Name: ${t.name}
Objective: ${t.objective}
Audience Type: ${t.audience_type}
Use Case: ${t.use_case}
Description: ${t.description}
`).join('\n---\n');

    const productPsych = offer.product_psychology || {};
    
    const userPrompt = `Recommend the best campaign template for this offer:

OFFER DETAILS:
- Name: ${offer.name}
- Description: ${offer.description || 'Not specified'}
- Price: ${offer.price_point || 'Not specified'}
- Target Outcome: ${offer.target_outcome || 'Not specified'}

PRODUCT PSYCHOLOGY:
- Positioning: ${productPsych.positioning || 'Not specified'}
- Buying Triggers: ${productPsych.buying_triggers || 'Not specified'}

AVAILABLE TEMPLATES:
${templatesInfo}

Choose the BEST template based on the matching rules and return your recommendation.`;

    console.log('Calling Lovable AI for template recommendation...');
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
    const recommendation = JSON.parse(content);

    // Find the template by slug
    const recommendedTemplate = templates.find(t => t.slug === recommendation.recommended_template_slug);
    
    if (!recommendedTemplate) {
      throw new Error(`Template with slug ${recommendation.recommended_template_slug} not found`);
    }

    // Update offer with recommendation
    const { error: updateError } = await supabase
      .from('offers')
      .update({
        recommended_template_id: recommendedTemplate.id,
        recommendation_reason: recommendation.reason,
        recommendation_confidence: recommendation.confidence
      })
      .eq('id', offerId);

    if (updateError) throw updateError;

    console.log('Campaign template recommendation saved successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      recommendation: {
        template_id: recommendedTemplate.id,
        template_name: recommendedTemplate.name,
        template_slug: recommendedTemplate.slug,
        confidence: recommendation.confidence,
        reason: recommendation.reason
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in recommend-campaign-template:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to recommend campaign template' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
