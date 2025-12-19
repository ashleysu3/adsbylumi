import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

// URL validation to prevent SSRF attacks
function isValidPublicUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTPS (and HTTP for dev)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // Block private IP ranges, localhost, and cloud metadata endpoints
    const blockedPatterns = [
      /^127\./, // Loopback
      /^10\./, // Private Class A
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
      /^192\.168\./, // Private Class C
      /^169\.254\./, // Link-local (AWS metadata)
      /^0\./, // Invalid
      /^localhost$/i,
      /\.local$/i,
      /^metadata/i, // Cloud metadata
      /\.internal$/i,
    ];
    
    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      return { valid: false, error: 'Private or internal URLs are not allowed' };
    }
    
    // Block direct IP addresses (require DNS names)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return { valid: false, error: 'Direct IP addresses are not allowed' };
    }
    
    // Block IPv6 addresses
    if (hostname.includes(':')) {
      return { valid: false, error: 'IPv6 addresses are not allowed' };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerUrl, offerName } = await req.json();
    
    // Input validation
    if (!offerUrl) {
      return new Response(
        JSON.stringify({ error: 'Offer URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof offerUrl !== 'string' || offerUrl.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format or URL too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (offerName && (typeof offerName !== 'string' || offerName.length > 200)) {
      return new Response(
        JSON.stringify({ error: 'Offer name too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF protection - validate URL
    const urlValidation = isValidPublicUrl(offerUrl);
    if (!urlValidation.valid) {
      return new Response(
        JSON.stringify({ error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting offer info from:', offerUrl);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch offer page content with timeout and size limits
    let offerContent = '';
    let fetchSuccess = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const offerResponse = await fetch(offerUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (YourAdAssistant/1.0)'
        }
      });
      
      clearTimeout(timeout);

      // Check content length before reading
      const contentLength = offerResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 2000000) {
        console.log('Content too large, limiting extraction');
      }

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
        .substring(0, 25000); // Limit to 25k chars
      
      fetchSuccess = offerContent.length > 200;
      console.log(`Extracted ${offerContent.length} characters from page`);
    } catch (error: any) {
      console.error('Error fetching offer page:', error.message);
      if (error.name === 'AbortError') {
        console.log('Request timed out');
      }
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
