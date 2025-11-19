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
    const { websiteUrl } = await req.json();
    console.log('Extracting brand info from:', websiteUrl);

    if (!websiteUrl) {
      throw new Error('Website URL is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch website content
    let websiteContent = '';
    try {
      const websiteResponse = await fetch(websiteUrl);
      const html = await websiteResponse.text();
      // Extract text content (simple extraction, strips HTML tags)
      websiteContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000);
    } catch (error) {
      console.error('Error fetching website:', error);
      websiteContent = 'Unable to fetch website content';
    }

    const systemPrompt = `You are a brand strategist analyzing websites to extract key business information.
Your task is to analyze the website content and extract:
1. Value Proposition (What they offer) - A clear, concise statement of what the business provides
2. Target Audience (Who they serve) - Detailed description of their ideal customer
3. Industry - The primary industry or niche they operate in

Return ONLY a valid JSON object with these exact fields:
{
  "value_proposition": "string",
  "target_audience": "string", 
  "industry": "string"
}

Be specific and insightful. Use the actual language and positioning from the website.`;

    const userPrompt = `Analyze this website content and extract the brand information:\n\n${websiteContent}`;

    console.log('Calling Lovable AI for brand extraction...');
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
    const brandInfo = JSON.parse(content);

    console.log('Brand info extracted successfully');

    return new Response(JSON.stringify(brandInfo), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in extract-brand-info:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract brand info' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
