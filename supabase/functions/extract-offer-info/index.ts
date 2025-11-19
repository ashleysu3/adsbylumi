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
      offerContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000);
    } catch (error) {
      console.error('Error fetching offer page:', error);
      offerContent = 'Unable to fetch offer page content';
    }

    const systemPrompt = `You are a product analyst extracting key information from sales pages and offer pages.
Your task is to analyze the offer page content and extract:
1. Description - A clear description of what the product/offer includes (2-3 sentences)
2. Price Point - The price in text format (e.g., "$47", "$997", "Free", "Varies")
3. Target Outcome - The main transformation or result the customer gets

Return ONLY a valid JSON object with these exact fields:
{
  "description": "string",
  "price_point": "string",
  "target_outcome": "string"
}

Be specific and use the actual language from the sales page when possible.`;

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
