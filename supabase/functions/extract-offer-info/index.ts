import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerUrl, offerName } = await req.json();
    console.log('Extracting offer info from:', offerUrl);

    if (!offerUrl) {
      throw new Error('Offer URL is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch offer page content
    let offerContent = '';
    try {
      const offerResponse = await fetch(offerUrl);
      const html = await offerResponse.text();
      // Extract text content
      offerContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 12000);
    } catch (error) {
      console.error('Error fetching offer page:', error);
      offerContent = 'Unable to fetch offer page content';
    }

    const systemPrompt = `You are a product analyst extracting comprehensive information from sales pages and offer pages for ad creative generation.

Your task is to analyze the offer page content and extract ALL of the following:

1. **description** - A detailed description of what the product/offer includes (3-5 sentences). Include what's included, how it's delivered, and any bonuses.

2. **price_point** - The price in text format (e.g., "$47", "$997", "Free", "$297/month", "Varies"). Include any payment plans if mentioned.

3. **target_outcome** - The main transformation or result the customer gets. Be specific about the before/after state.

4. **key_benefits** - Array of 3-5 specific benefits or features mentioned on the page. Use the exact language when possible.

5. **pain_points_addressed** - Array of 2-4 pain points or problems the offer solves. What struggles does the target audience face?

6. **unique_selling_points** - Array of 2-3 things that make this offer different or special (guarantees, bonuses, methodology, credentials).

7. **social_proof** - Any testimonials, results, or credibility markers mentioned (e.g., "helped 500+ students", "as seen in Forbes", specific client results).

8. **emotional_hooks** - Array of 2-3 emotional triggers or desires the page appeals to (e.g., "freedom", "confidence", "financial security", "time with family").

9. **target_audience_indicators** - Who is this offer for? Any specific demographics, job titles, or situations mentioned.

10. **tone_and_voice** - Describe the overall tone of the sales page (e.g., "professional and authoritative", "friendly and conversational", "urgent and direct").

11. **cta_language** - The main call-to-action text used on the page (e.g., "Enroll Now", "Get Instant Access", "Book Your Call").

Return ONLY a valid JSON object with these exact fields:
{
  "description": "string",
  "price_point": "string", 
  "target_outcome": "string",
  "key_benefits": ["string"],
  "pain_points_addressed": ["string"],
  "unique_selling_points": ["string"],
  "social_proof": "string or null if none found",
  "emotional_hooks": ["string"],
  "target_audience_indicators": "string",
  "tone_and_voice": "string",
  "cta_language": "string"
}

Be specific and use the actual language from the sales page when possible. If you can't find information for a field, use reasonable inferences based on the content.`;

    const userPrompt = `Analyze this offer page and extract the product information:

Offer Name: ${offerName || 'Not specified'}
Page Content: ${offerContent}

Extract the description, price, and target outcome.`;

    console.log('Calling Lovable AI for offer extraction...');
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
    console.log('AI Response received');
    
    const content = aiData.choices[0].message.content;
    const offerInfo = JSON.parse(content);

    console.log('Offer info extracted successfully');

    return new Response(JSON.stringify(offerInfo), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in extract-offer-info:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract offer info' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
