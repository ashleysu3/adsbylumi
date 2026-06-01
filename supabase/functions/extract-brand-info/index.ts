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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const websiteUrlInput = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim() : '';

    // Input validation
    if (!websiteUrlInput) {
      console.log('extract-brand-info: missing websiteUrl');
      return new Response(
        JSON.stringify({ error: 'Website URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize URL: collapse stray slashes after scheme, add https:// if missing
    const cleaned = websiteUrlInput.replace(/[\u200B-\u200D\uFEFF\s]/g, '');
    let websiteUrl: string;
    const schemeMatch = cleaned.match(/^(https?:)\/*(.*)$/i);
    if (schemeMatch) {
      websiteUrl = `${schemeMatch[1].toLowerCase()}//${schemeMatch[2].replace(/^\/+/, '')}`;
    } else {
      websiteUrl = `https://${cleaned.replace(/^\/+/, '')}`;
    }

    // Validate hostname is present
    try {
      const parsed = new URL(websiteUrl);
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        return new Response(
          JSON.stringify({ error: 'Please enter a valid website URL (e.g. yourbrand.com)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (websiteUrl.length > 500) {
      console.log('extract-brand-info: url too long');
      return new Response(
        JSON.stringify({ error: 'Invalid URL format or URL too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF protection - validate URL
    const urlValidation = isValidPublicUrl(websiteUrl);
    if (!urlValidation.valid) {
      console.log('extract-brand-info: url rejected', { reason: urlValidation.error });
      return new Response(
        JSON.stringify({ error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting brand info from:', websiteUrl);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch website content with timeout and size limits
    let websiteContent = '';
    let pageTitle = '';
    let metaDescription = '';
    let fetchFailed = false;
    let fetchErrorMessage = '';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const websiteResponse = await fetch(websiteUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          // Use a realistic browser UA so Cloudflare / WAF-protected sites don't 403 us.
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Upgrade-Insecure-Requests': '1',
        }
      });

      clearTimeout(timeout);

      if (!websiteResponse.ok) {
        fetchFailed = true;
        fetchErrorMessage = `Website returned ${websiteResponse.status}. Please double-check the URL.`;
      } else {
        // Check content length before reading
        const contentLength = websiteResponse.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 3000000) {
          console.log('Content too large, skipping fetch');
          websiteContent = 'Unable to fetch website content - page too large';
        } else {
          const html = await websiteResponse.text();

          // Extract page title
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

          // Extract meta description
          const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                                html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
          metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

          // Extract og:description as fallback
          if (!metaDescription) {
            const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
            metaDescription = ogDescMatch ? ogDescMatch[1].trim() : '';
          }

          // Extract headings (h1, h2, h3) for key messaging
          const headings: string[] = [];
          const headingMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
          for (const match of headingMatches) {
            const headingText = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            if (headingText && headingText.length > 3 && headingText.length < 200) {
              headings.push(headingText);
            }
            if (headings.length >= 15) break;
          }

          // Extract main content areas (article, main, sections)
          let mainContent = '';
          const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                            html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
          if (mainMatch) {
            mainContent = mainMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }

          // Extract body content as fallback, removing scripts/styles
          let bodyContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          // Build structured content for AI
          const contentParts: string[] = [];

          if (pageTitle) contentParts.push(`PAGE TITLE: ${pageTitle}`);
          if (metaDescription) contentParts.push(`META DESCRIPTION: ${metaDescription}`);
          if (headings.length > 0) contentParts.push(`KEY HEADINGS:\n${headings.map(h => `- ${h}`).join('\n')}`);
          if (mainContent) contentParts.push(`MAIN CONTENT:\n${mainContent.substring(0, 3000)}`);
          if (!mainContent && bodyContent) contentParts.push(`PAGE CONTENT:\n${bodyContent.substring(0, 3000)}`);

          websiteContent = contentParts.join('\n\n');
          console.log('Extracted content length:', websiteContent.length);
        }
      }
    } catch (error: any) {
      console.error('Error fetching website:', error.message);
      fetchFailed = true;
      if (error.name === 'AbortError') {
        fetchErrorMessage = "We couldn't reach your website (timed out). Please double-check the URL.";
      } else if (error.message?.includes('dns error') || error.message?.includes('Name or service not known')) {
        fetchErrorMessage = "We couldn't find that website. Please double-check the URL.";
      } else {
        fetchErrorMessage = "We couldn't reach your website. Please double-check the URL or try again.";
      }
    }

    // If the direct fetch failed (Cloudflare, WAF, JS-rendered, etc.) or returned
    // too little content, fall back to Firecrawl which handles bot protection.
    if (fetchFailed || !websiteContent || websiteContent.length < 50) {
      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      if (FIRECRAWL_API_KEY) {
        try {
          console.log('Direct fetch insufficient, trying Firecrawl fallback...');
          const fcRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: websiteUrl,
              formats: ['markdown'],
              onlyMainContent: true,
            }),
          });
          const fcData = await fcRes.json().catch(() => null);
          const md: string | undefined =
            fcData?.data?.markdown || fcData?.markdown;
          const meta = fcData?.data?.metadata || fcData?.metadata || {};
          if (fcRes.ok && md && md.length > 50) {
            const parts: string[] = [];
            if (meta?.title) parts.push(`PAGE TITLE: ${meta.title}`);
            if (meta?.description) parts.push(`META DESCRIPTION: ${meta.description}`);
            parts.push(`PAGE CONTENT:\n${md.substring(0, 4000)}`);
            websiteContent = parts.join('\n\n');
            fetchFailed = false;
            console.log('Firecrawl fallback success, content length:', websiteContent.length);
          } else {
            console.warn('Firecrawl fallback failed:', fcRes.status, JSON.stringify(fcData)?.slice(0, 300));
          }
        } catch (fcErr: any) {
          console.error('Firecrawl fallback error:', fcErr?.message || fcErr);
        }
      } else {
        console.warn('FIRECRAWL_API_KEY not configured — cannot fall back.');
      }
    }

    if (fetchFailed || !websiteContent || websiteContent.length < 50) {
      return new Response(
        JSON.stringify({ error: fetchErrorMessage || "We couldn't read enough content from that page to analyze your brand." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a brand strategist analyzing websites to extract key business information.
Your task is to analyze the website content and extract ACCURATE, SPECIFIC information:

1. Value Proposition (What they offer) - Be SPECIFIC about their actual products/services. Don't be vague.
   Examples: "Online fitness coaching programs for busy professionals" NOT "solutions to help you succeed"
   
2. Target Audience (Who they serve) - Describe the SPECIFIC person they help. Use details from their copy.
   Examples: "Women over 40 who want to lose weight without restrictive diets" NOT "people looking to improve"
   
3. Industry - The specific niche, not broad categories.
   Examples: "Online fitness coaching" or "E-commerce marketing" NOT "Professional Services"

RULES:
- Use EXACT language and specifics from the website when possible
- If the website mentions specific outcomes, include them
- If you can't determine something clearly, say "Could not determine from website"
- Be concise but specific - aim for 1-2 sentences max per field

Return ONLY a valid JSON object:
{
  "value_proposition": "string",
  "target_audience": "string", 
  "industry": "string"
}`;

    const userPrompt = `Analyze this website content and extract SPECIFIC brand information. Use the exact language from the site where possible:\n\nWEBSITE URL: ${websiteUrl}\n\n${websiteContent}`;

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
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');

    const content =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.choices?.[0]?.text ??
      aiData?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      "";

    if (!content) {
      console.error('Unexpected AI response shape:', aiData);
      throw new Error('AI response was empty or in an unexpected format');
    }

    console.log('Raw AI content:', content);

    const extractJsonObject = (text: string) => {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? text).trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      const candidate = firstBrace !== -1 && lastBrace !== -1 ? raw.slice(firstBrace, lastBrace + 1) : raw;
      return JSON.parse(candidate);
    };

    const parsed = extractJsonObject(content);

    const brandInfo = {
      value_proposition: typeof parsed?.value_proposition === 'string' ? parsed.value_proposition : String(parsed?.value_proposition ?? ''),
      target_audience: typeof parsed?.target_audience === 'string' ? parsed.target_audience : String(parsed?.target_audience ?? ''),
      industry: typeof parsed?.industry === 'string' ? parsed.industry : String(parsed?.industry ?? ''),
    };


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
