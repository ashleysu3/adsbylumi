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

    // Fetch offer page content - get as much as possible
    let offerContent = '';
    let fetchSuccess = false;
    try {
      const offerResponse = await fetch(offerUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const html = await offerResponse.text();
      
      // Extract text content more thoroughly - remove scripts, styles, but keep structure hints
      offerContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 25000); // Increased to 25k chars for more content
      
      fetchSuccess = offerContent.length > 200;
      console.log(`Extracted ${offerContent.length} characters from page`);
    } catch (error) {
      console.error('Error fetching offer page:', error);
      offerContent = '';
    }

    const systemPrompt = `You are a product analyst extracting comprehensive information from sales pages and offer pages for ad creative generation.

Your task is to analyze ALL the copy on the page and extract EVERYTHING that could be useful for creating compelling ads.

EXTRACT THE FOLLOWING (be thorough - pull actual quotes and language from the page):

1. **raw_copy_highlights** - Array of 5-10 of the most compelling phrases, headlines, or copy snippets directly from the page. These are exact quotes or near-quotes that capture the offer's voice.

2. **description** - A comprehensive description of what the product/offer includes (4-6 sentences). Include what's included, how it's delivered, format, duration, and any bonuses.

3. **price_point** - The price in text format (e.g., "$47", "$997", "Free", "$297/month"). Include any payment plans, crossed-out prices, or "value" comparisons if mentioned.

4. **target_outcome** - The main transformation or result. Be SPECIFIC about the before/after state. What will change in their life/business?

5. **key_benefits** - Array of 5-7 specific benefits or features mentioned. Use the exact language from the page when possible.

6. **pain_points_addressed** - Array of 3-5 pain points or problems the offer solves. What struggles does the target audience currently face?

7. **unique_selling_points** - Array of 2-4 differentiators (guarantees, bonuses, methodology, credentials, speed of results, unique approach).

8. **social_proof** - Specific testimonials, results, numbers, or credibility markers. Include exact quotes if available, specific numbers ("helped 500+ students"), media mentions, etc.

9. **emotional_hooks** - Array of 3-4 emotional triggers the page appeals to (freedom, confidence, security, status, belonging, achievement, etc.)

10. **target_audience_indicators** - Who is this explicitly for? Job titles, situations, demographics, or "this is for you if..." statements.

11. **tone_and_voice** - Describe the overall tone (professional, conversational, urgent, luxurious, friendly, authoritative, etc.)

12. **cta_language** - All call-to-action text used (buttons, links). Array of strings.

13. **objections_addressed** - Any FAQ items, "but what if..." responses, or objection handling found on the page.

14. **content_summary** - A 2-3 sentence summary of what information was successfully extracted from the page.

15. **missing_info** - Array of specific pieces of information that seem important but couldn't be found on the page. Be specific about what's missing.

16. **needs_clarification** - Boolean. True if critical information (price, what's included, or target outcome) is unclear or missing.

17. **clarification_questions** - If needs_clarification is true, provide 1-3 specific questions to ask the user.

Return ONLY valid JSON with these exact fields. If you can't find information for a field, use reasonable inferences OR leave as empty array/null and add to missing_info.`;

    const userPrompt = `Analyze this offer page and extract ALL available copy and information for ad creative generation.

Offer Name: ${offerName || 'Not specified'}
URL: ${offerUrl}

Page Content:
${fetchSuccess ? offerContent : 'Unable to fetch page content - the page may be behind a login, have bot protection, or the URL may be incorrect.'}

${!fetchSuccess ? 'Since the page content could not be fetched, set needs_clarification to true and ask for the key details manually.' : 'Extract everything you can find. Pull exact quotes and language. Be thorough.'}`;

    console.log('Calling Lovable AI for comprehensive offer extraction...');
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

    // Add metadata about extraction
    offerInfo.extraction_success = fetchSuccess;
    offerInfo.extracted_length = offerContent.length;

    console.log('Offer info extracted successfully:', {
      hasDescription: !!offerInfo.description,
      hasPrice: !!offerInfo.price_point,
      benefitsCount: offerInfo.key_benefits?.length || 0,
      needsClarification: offerInfo.needs_clarification
    });

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
