import { getCorsHeaders } from '../_shared/cors.ts';

// URL validation to prevent SSRF attacks
function isValidPublicUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }
    const hostname = url.hostname.toLowerCase();
    const blockedPatterns = [
      /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
      /^169\.254\./, /^0\./, /^localhost$/i, /\.local$/i, /^metadata/i, /\.internal$/i,
    ];
    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      return { valid: false, error: 'Private or internal URLs are not allowed' };
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return { valid: false, error: 'Direct IP addresses are not allowed' };
    }
    if (hostname.includes(':')) {
      return { valid: false, error: 'IPv6 addresses are not allowed' };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Fetch page content using Firecrawl for reliable scraping
async function fetchWithFirecrawl(url: string): Promise<{ content: string; success: boolean }> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('FIRECRAWL_API_KEY not configured, falling back to basic fetch');
    return { content: '', success: false };
  }

  try {
    console.log('Scraping with Firecrawl:', url);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      console.error('Firecrawl error:', data?.error || response.status);
      return { content: '', success: false };
    }

    const markdown = data.data?.markdown || data.markdown || '';
    console.log(`Firecrawl extracted ${markdown.length} characters`);
    return { content: markdown.substring(0, 50000), success: markdown.length > 100 };
  } catch (err: any) {
    console.error('Firecrawl fetch failed:', err.message);
    return { content: '', success: false };
  }
}

// Basic fetch fallback
async function fetchBasic(url: string): Promise<{ content: string; success: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);

    const html = await response.text();
    const content = html
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
      .substring(0, 25000);

    const success = content.length > 200;
    console.log(`Basic fetch extracted ${content.length} characters`);
    return { content, success };
  } catch (err: any) {
    console.error('Basic fetch failed:', err.message);
    return { content: '', success: false };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerUrl, offerName, pastedContent } = await req.json();
    
    if (!offerUrl && !pastedContent) {
      return new Response(
        JSON.stringify({ error: 'Offer URL or pasted content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (offerUrl && (typeof offerUrl !== 'string' || offerUrl.length > 500)) {
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

    let offerContent = '';
    let fetchSuccess = false;

    if (pastedContent && typeof pastedContent === 'string' && pastedContent.trim().length > 50) {
      console.log('Using user-pasted content, length:', pastedContent.length);
      offerContent = pastedContent.trim().substring(0, 50000);
      fetchSuccess = true;
    } else if (offerUrl) {
      const urlValidation = isValidPublicUrl(offerUrl);
      if (!urlValidation.valid) {
        return new Response(
          JSON.stringify({ error: urlValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Extracting offer info from:', offerUrl);

      // Try Firecrawl first, fall back to basic fetch
      const firecrawlResult = await fetchWithFirecrawl(offerUrl);
      if (firecrawlResult.success) {
        offerContent = firecrawlResult.content;
        fetchSuccess = true;
      } else {
        console.log('Firecrawl unavailable or failed, trying basic fetch...');
        const basicResult = await fetchBasic(offerUrl);
        offerContent = basicResult.content;
        fetchSuccess = basicResult.success;
      }
    }

    const systemPrompt = `You are a product analyst extracting comprehensive information from sales pages and offer pages for ad creative generation.

Your task is to analyze ALL the copy on the page and extract EVERYTHING that could be useful for creating compelling ads.

FORMATTING REQUIREMENTS (CRITICAL):
All text fields must be formatted for easy reading:
- Use line breaks between distinct ideas
- Use bullet points (•) for lists within text
- Keep paragraphs short (2-3 sentences max)
- Use spacing to separate sections
- Never write walls of text

EXTRACT THE FOLLOWING (be thorough - pull actual quotes and language from the page):

1. **raw_copy_highlights** - Array of 5-10 of the most compelling phrases, headlines, or copy snippets directly from the page. These are exact quotes or near-quotes that capture the offer's voice.

2. **description** - A comprehensive, well-formatted description of what the product/offer includes. Structure it like this:

   [What it is - 1-2 sentences]
   
   What's Included:
   • [Item 1]
   • [Item 2]
   • [Item 3]
   
   [How it's delivered + any bonuses - 1-2 sentences]

3. **price_point** - The price in text format (e.g., "$47", "$997", "Free", "$297/month"). Include any payment plans, crossed-out prices, or "value" comparisons if mentioned.

4. **target_outcome** - The main transformation or result. Return this as a single plain string, not an object or JSON. Format it as: "Before: [Current state/problem]. After: [Transformed state/result]." Be SPECIFIC about what will change in their life/business.

5. **key_benefits** - Array of 5-7 specific benefits. Each benefit should be a clear, complete statement.

6. **pain_points_addressed** - Array of 3-5 pain points. Format each as a complete, relatable statement the audience would identify with.

7. **unique_selling_points** - Array of 2-4 differentiators (guarantees, bonuses, methodology, credentials, speed of results, unique approach).

8. **social_proof** - Specific testimonials, results, numbers, or credibility markers. Format as:
   
   • [Result/testimonial 1]
   • [Result/testimonial 2]
   
   Include exact quotes if available, specific numbers ("helped 500+ students"), media mentions, etc.

9. **emotional_hooks** - Array of 3-4 emotional triggers the page appeals to (freedom, confidence, security, status, belonging, achievement, etc.)

10. **target_audience_indicators** - Who is this explicitly for? Format clearly:
    
    This is for:
    • [Audience type 1]
    • [Audience type 2]
    
    Include job titles, situations, demographics, or "this is for you if..." statements.

11. **tone_and_voice** - Describe the overall tone (professional, conversational, urgent, luxurious, friendly, authoritative, etc.)

12. **cta_language** - All call-to-action text used (buttons, links). Array of strings.

13. **objections_addressed** - Any FAQ items, "but what if..." responses, or objection handling found on the page.

14. **content_summary** - A 2-3 sentence summary of what information was successfully extracted from the page.

15. **missing_info** - Array of specific pieces of information that seem important but couldn't be found on the page. Be specific about what's missing.

16. **needs_clarification** - Boolean. True if critical information (price, what's included, or target outcome) is unclear or missing.

17. **clarification_questions** - If needs_clarification is true, provide 1-3 specific questions to ask the user.

18. **suggested_page_goal** - One of: "purchase", "discovery_call", "free_resource", or "other". Determine based on these rules:
    - If the page collects leads (email/name) for a free or low-cost resource like a webinar, training, challenge, masterclass, PDF, guide, checklist, quiz, opt-in, or freebie → "free_resource"
    - If the page's primary CTA is to book a call, schedule a consultation, or apply → "discovery_call"
    - If the page sells a product or service for payment (course, coaching package, membership, physical product) → "purchase"
    - Otherwise → "other"
    IMPORTANT: Free webinars, free trainings, free challenges, and any registration-based events are ALWAYS "free_resource", even if they eventually lead to a sale.

Return ONLY valid JSON with these exact fields. If you can't find information for a field, use reasonable inferences OR leave as empty array/null and add to missing_info.`;

    const userPrompt = `Analyze this offer page and extract ALL available copy and information for ad creative generation.

Offer Name: ${offerName || 'Not specified'}
${offerUrl ? `URL: ${offerUrl}` : 'URL: Not provided (user pasted content directly)'}

Page Content:
${fetchSuccess ? offerContent : 'Unable to fetch page content - the page may be behind a login, have bot protection, or the URL may be incorrect.'}

${!fetchSuccess ? 'Since the page content could not be fetched, set needs_clarification to true and ask for the key details manually.' : 'Extract everything you can find. Pull exact quotes and language. Be thorough.'}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

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
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');

    const rawContent =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.choices?.[0]?.text ??
      aiData?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      "";

    if (!rawContent) {
      console.error('Unexpected AI response shape:', aiData);
      throw new Error('AI response was empty');
    }

    // Robust JSON extraction with repair
    const extractJson = (text: string) => {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      let raw = (codeBlock?.[1] ?? text).trim();
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last !== -1) {
        raw = raw.slice(first, last + 1);
      }
      raw = raw
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/"\s*\n\s*"/g, '", "');

      try {
        return JSON.parse(raw);
      } catch (e) {
        let open = 0, close = 0;
        for (const ch of raw) { if (ch === '{') open++; if (ch === '}') close++; }
        let repaired = raw;
        if (open > close) repaired += '}'.repeat(open - close);
        let ao = 0, ac = 0;
        for (const ch of repaired) { if (ch === '[') ao++; if (ch === ']') ac++; }
        if (ao > ac) repaired = repaired.replace(/,?\s*$/, '') + ']'.repeat(ao - ac);
        repaired = repaired.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      }
    };

    const offerInfo = extractJson(rawContent);

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
