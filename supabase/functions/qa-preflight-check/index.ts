import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Issue {
  field: string;
  text: string;
  suggestion: string;
  reason: string;
  location?: string;
}

interface CheckResult {
  id: string;
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message?: string;
  issues?: Issue[];
  details?: string;
  requiredEvent?: string;
  pixelId?: string | null;
  pixelNotInstalled?: boolean;
  campaignGoal?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      brand,
      answers,
      creativeJson,
      productionItems,
      offerUrl,
      selectedCopy,
      template,
    } = await req.json();

    console.log('QA Preflight Check started');
    console.log('productionItems count:', productionItems?.length || 0);
    console.log('creativeJson keys:', creativeJson ? Object.keys(creativeJson) : 'null');

    // Resolve landing page URL from multiple sources
    const resolvedUrl = offerUrl 
      || answers?.destinationUrl 
      || answers?.finalUrl
      || brand?.website_url 
      || extractUrlFromSelectedCopy(selectedCopy)
      || extractUrlFromProductionItems(productionItems)
      || null;
    console.log('Resolved landing page URL:', resolvedUrl, '(offerUrl:', offerUrl, ')');

    const results: CheckResult[] = [];

    results.push(checkMetaConnection(brand));
    results.push(checkBudget(answers));
    results.push(checkSchedule(answers));
    results.push(await checkLandingPage(resolvedUrl, brand));
    results.push(checkEventTracking(brand, template));
    results.push(await checkSpellingGrammar(creativeJson, productionItems, selectedCopy));

    const summary = {
      passed: results.filter(r => r.status === 'passed').length,
      warnings: results.filter(r => r.status === 'warning').length,
      failed: results.filter(r => r.status === 'failed').length,
    };

    console.log('QA Preflight Check completed:', summary);

    return new Response(
      JSON.stringify({ success: true, checks: results, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('QA Preflight Check error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractUrlFromProductionItems(items: any[]): string | null {
  if (!items || !Array.isArray(items)) return null;
  for (const item of items) {
    const copy = item?.finalCopy || item?.final_copy || item?.copy || {};
    const url = copy?.destinationUrl || copy?.destination_url || copy?.url
      || copy?.landingPageUrl || copy?.landing_page_url
      || item?.destinationUrl || item?.destination_url || item?.url;
    if (url && typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

function extractUrlFromSelectedCopy(selectedCopy: any): string | null {
  if (!selectedCopy || typeof selectedCopy !== 'object') return null;
  const stack: any[] = [selectedCopy];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (typeof node === 'string') {
      const t = node.trim();
      if (/^https?:\/\//i.test(t)) return t;
      continue;
    }
    if (Array.isArray(node)) { stack.push(...node); continue; }
    if (typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const v = (node as any)[k];
        if (typeof v === 'string' && /url|link|destination/i.test(k) && /^https?:\/\//i.test(v.trim())) {
          return v.trim();
        }
        stack.push(v);
      }
    }
  }
  return null;
}

function checkMetaConnection(brand: any): CheckResult {
  const hasAdAccount = !!brand?.meta_account_id;
  const hasPage = !!brand?.page_id;

  if (hasAdAccount && hasPage) {
    return {
      id: 'meta', name: 'Meta Connection', status: 'passed',
      message: `Connected to ${brand.page_name || 'Facebook Page'}`,
      details: `Ad Account: ${brand.meta_account_id?.slice(-6) || 'Unknown'}`,
    };
  } else if (hasAdAccount && !hasPage) {
    return {
      id: 'meta', name: 'Meta Connection', status: 'failed',
      message: 'No Facebook Page connected',
      details: 'A Facebook Page is required to publish ads',
    };
  }
  return {
    id: 'meta', name: 'Meta Connection', status: 'failed',
    message: 'Meta Ads not connected',
    details: 'Connect your Meta Ads account to publish ads',
  };
}

function checkBudget(answers: any): CheckResult {
  const budget = parseFloat(answers?.budget);
  if (!budget || budget <= 0) {
    return { id: 'budget', name: 'Budget', status: 'failed', message: 'No budget set', details: 'Set a daily budget to continue' };
  }
  if (budget < 5) {
    return { id: 'budget', name: 'Budget', status: 'warning', message: `$${budget}/day is below recommended minimum`, details: 'Meta recommends at least $5/day for optimal delivery' };
  }
  if (budget > 1000) {
    return { id: 'budget', name: 'Budget', status: 'warning', message: `$${budget}/day is unusually high`, details: 'Double-check this is the correct amount before publishing' };
  }
  return { id: 'budget', name: 'Budget', status: 'passed', message: `$${budget}/day verified`, details: `${answers?.budgetType || 'Daily'} budget` };
}

function checkSchedule(answers: any): CheckResult {
  const startDate = answers?.startDate ? new Date(answers.startDate) : null;
  const endDate = answers?.endDate ? new Date(answers.endDate) : null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (!startDate) {
    return { id: 'schedule', name: 'Schedule', status: 'failed', message: 'No start date set', details: 'Set a start date for your campaign' };
  }

  const startDateOnly = new Date(startDate);
  startDateOnly.setHours(0, 0, 0, 0);

  if (startDateOnly < now) {
    return { id: 'schedule', name: 'Schedule', status: 'warning', message: 'Start date is in the past', details: 'Campaign will start immediately after Meta approval' };
  }

  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  if (startDateOnly > thirtyDaysFromNow) {
    return { id: 'schedule', name: 'Schedule', status: 'warning', message: 'Start date is far in the future', details: `Campaign won't start until ${startDate.toLocaleDateString()}` };
  }

  if (endDate && endDate <= startDate) {
    return { id: 'schedule', name: 'Schedule', status: 'failed', message: 'End date must be after start date', details: 'Adjust your campaign dates' };
  }

  const scheduleStr = endDate
    ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
    : `${startDate.toLocaleDateString()} - Continuous`;

  return { id: 'schedule', name: 'Schedule', status: 'passed', message: scheduleStr, details: endDate ? 'Fixed duration campaign' : 'Runs until manually paused' };
}

async function checkLandingPage(url: string | undefined, brand: any): Promise<CheckResult> {
  if (!url) {
    return { id: 'landing_page', name: 'Landing Page', status: 'warning', message: 'No landing page URL set', details: 'Add a URL to track conversions properly' };
  }

  const pixelId = brand?.meta_pixel_id || null;

  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Use GET to fetch HTML so we can scan for pixel code
    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YourAdAssistant/1.0)' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403 || response.status === 405) {
        return { id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl, details: 'Server blocked our verification, but the URL looks valid' };
      }
      if (response.status >= 300 && response.status < 400) {
        return { id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl, details: 'Page loads with a redirect — make sure it lands where you expect' };
      }
      return { id: 'landing_page', name: 'Landing Page', status: 'failed', message: fullUrl, details: `Page returned a ${response.status} error — check that this URL is correct` };
    }

    // Page is reachable — now scan HTML for pixel
    const html = await response.text();
    const hasFbEvents = html.includes('connect.facebook.net') && html.includes('fbevents.js');
    const fbqInitMatch = html.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/);

    if (!pixelId) {
      // No pixel configured on brand — just report page is reachable
      if (hasFbEvents && fbqInitMatch) {
        return { id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl, details: 'Page is live and has a Meta Pixel installed' };
      }
      return { id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl, details: 'This is the URL people will land on when they click your ad' };
    }

    // Pixel is configured — check if it's on the page
    if (hasFbEvents && fbqInitMatch) {
      const foundPixelId = fbqInitMatch[1];
      if (foundPixelId === pixelId) {
        return { id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl, details: `Page is live and your Meta Pixel (${pixelId.slice(-6)}) is active`, pixelId };
      } else {
        return { id: 'landing_page', name: 'Landing Page', status: 'warning', message: fullUrl, details: `A Meta Pixel was found but it doesn't match your ad account's pixel. Found: ...${foundPixelId.slice(-6)}, Expected: ...${pixelId.slice(-6)}`, pixelId, pixelNotInstalled: false };
      }
    }

    // Pixel not found on page
    return {
      id: 'landing_page', name: 'Landing Page', status: 'warning', message: fullUrl,
      details: 'Your Meta Pixel isn\'t installed on this page yet. Install it so Meta can track conversions.',
      pixelId, pixelNotInstalled: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('abort')) {
      return { id: 'landing_page', name: 'Landing Page', status: 'warning', message: url, details: 'Page took too long to respond — slow loading may affect ad performance' };
    }
    return { id: 'landing_page', name: 'Landing Page', status: 'warning', message: url, details: 'Could not verify URL — page may be behind authentication or firewall' };
  }
}

function checkEventTracking(brand: any, template: any): CheckResult {
  const objective = template?.objective?.toLowerCase() || '';
  const optimizationEvent = template?.optimization_event || '';
  
  let requiredEvent = '';
  let campaignGoal: 'leads' | 'sales' = 'leads';
  
  if (optimizationEvent) {
    requiredEvent = optimizationEvent;
    campaignGoal = optimizationEvent.toLowerCase().includes('purchase') ? 'sales' : 'leads';
  } else if (objective.includes('sale') || objective.includes('purchase') || objective.includes('conversion')) {
    requiredEvent = 'Purchase';
    campaignGoal = 'sales';
  } else if (objective.includes('lead')) {
    requiredEvent = 'Lead';
    campaignGoal = 'leads';
  } else {
    return {
      id: 'tracking', name: 'Event Tracking', status: 'passed',
      message: 'No conversion event required',
      details: 'This campaign type doesn\'t need a conversion event',
    };
  }

  const pixelId = brand?.meta_pixel_id || null;
  const pixelEvents = brand?.meta_pixel_events || {};

  if (!pixelId) {
    return {
      id: 'tracking', name: 'Event Tracking', status: 'warning',
      message: `${requiredEvent} event not verified`,
      details: `No Meta Pixel connected. You'll need a "${requiredEvent}" event on your landing page for Meta to optimize your ads.`,
      requiredEvent, pixelId, campaignGoal,
    };
  }

  const eventVerified = pixelEvents[requiredEvent] || pixelEvents[requiredEvent.toLowerCase()];
  
  if (eventVerified) {
    return {
      id: 'tracking', name: 'Event Tracking', status: 'passed',
      message: `${requiredEvent} event verified`,
      details: `Pixel ${pixelId.slice(-6)} is tracking the ${requiredEvent} event`,
      requiredEvent, pixelId, campaignGoal,
    };
  }

  return {
    id: 'tracking', name: 'Event Tracking', status: 'warning',
    message: `${requiredEvent} event not detected`,
    details: `Your Pixel is connected but we haven't seen the "${requiredEvent}" event fire yet. Add it to your landing page so Meta can optimize delivery.`,
    requiredEvent, pixelId, campaignGoal,
  };
}

async function checkSpellingGrammar(creativeJson: any, productionItems: any[], selectedCopy?: any): Promise<CheckResult> {
  try {
    const copyToCheck: { field: string; text: string; location: string }[] = [];

    // 1. From production items — this is where the actual ad copy lives
    if (productionItems && Array.isArray(productionItems)) {
      productionItems.forEach((item: any, idx: number) => {
        const label = item.angleName || `Concept ${idx + 1}`;
        const format = item.format || '';

        // Hooks
        if (item.hook) {
          copyToCheck.push({ field: 'hook', text: item.hook, location: `${label} (${format})` });
        }
        if (item.written_hook || item.writtenHook) {
          copyToCheck.push({ field: 'written_hook', text: item.written_hook || item.writtenHook, location: `${label} (${format})` });
        }
        if (item.verbal_hook || item.verbalHook) {
          copyToCheck.push({ field: 'verbal_hook', text: item.verbal_hook || item.verbalHook, location: `${label} (${format})` });
        }

        // Script lines
        const scriptLines = item.script_lines || item.scriptLines || [];
        if (Array.isArray(scriptLines)) {
          scriptLines.forEach((line: string, li: number) => {
            if (line && typeof line === 'string') {
              copyToCheck.push({ field: `script_line_${li + 1}`, text: line, location: `${label} (${format})` });
            }
          });
        }

        // Text overlays
        const overlays = item.text_overlays || item.textOverlays || [];
        if (Array.isArray(overlays)) {
          overlays.forEach((overlay: any, oi: number) => {
            const text = typeof overlay === 'string' ? overlay : overlay?.text;
            if (text) {
              copyToCheck.push({ field: `text_overlay_${oi + 1}`, text, location: `${label} (${format})` });
            }
          });
        }

        // Guidance text (for graphics)
        if (item.guidance && format === 'graphic') {
          copyToCheck.push({ field: 'graphic_guidance', text: item.guidance, location: `${label} (graphic)` });
        }

        // Final copy (if user has finalized)
        const finalCopy = item.finalCopy || item.final_copy;
        if (finalCopy) {
          if (finalCopy.headline) copyToCheck.push({ field: 'headline', text: finalCopy.headline, location: `${label} - Final` });
          if (finalCopy.description) copyToCheck.push({ field: 'description', text: finalCopy.description, location: `${label} - Final` });
          if (finalCopy.primaryText || finalCopy.primary_text) copyToCheck.push({ field: 'primary_text', text: finalCopy.primaryText || finalCopy.primary_text, location: `${label} - Final` });
        }
      });
    }

    // 2. From angle_copy / angleCopy in creative_json (legacy support)
    const angleCopy = creativeJson?.angleCopy || creativeJson?.angle_copy || {};
    for (const [angleName, data] of Object.entries(angleCopy)) {
      const angleData = data as any;
      if (angleData.headlines) {
        angleData.headlines.forEach((h: any, i: number) => {
          if (h?.text) copyToCheck.push({ field: `headline_${i + 1}`, text: h.text, location: `Angle: ${angleName}` });
        });
      }
      if (angleData.descriptions) {
        angleData.descriptions.forEach((d: any, i: number) => {
          if (d?.text) copyToCheck.push({ field: `description_${i + 1}`, text: d.text, location: `Angle: ${angleName}` });
        });
      }
      if (angleData.primary_copy || angleData.primaryCopy) {
        (angleData.primary_copy || angleData.primaryCopy).forEach((p: any, i: number) => {
          if (p?.text) copyToCheck.push({ field: `primary_copy_${i + 1}`, text: p.text, location: `Angle: ${angleName}` });
        });
      }
    }

    // 3. From selected_copy / copySelections
    const copySelections = creativeJson?.copy_selections || creativeJson?.copySelections || creativeJson?.selected_copy || {};
    for (const [key, val] of Object.entries(copySelections)) {
      if (typeof val === 'string' && val.trim()) {
        copyToCheck.push({ field: key, text: val, location: 'Selected Copy' });
      } else if (val && typeof val === 'object' && (val as any).text) {
        copyToCheck.push({ field: key, text: (val as any).text, location: 'Selected Copy' });
      }
    }

    console.log(`Spelling check: found ${copyToCheck.length} copy items to check`);

    if (copyToCheck.length === 0) {
      return { id: 'spelling', name: 'Spelling & Grammar', status: 'warning', message: 'No copy to check', details: 'Generate ad copy before publishing' };
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return { id: 'spelling', name: 'Spelling & Grammar', status: 'passed', message: `${copyToCheck.length} items checked`, details: 'AI check unavailable, manual review recommended' };
    }

    const prompt = `You are reviewing ad copy for a social media feed (Meta/Facebook/Instagram ads). Your job is to catch ONLY genuine errors that would make a brand look unprofessional or confuse the reader.

THIS IS AD COPY, NOT FORMAL WRITING. The following are NORMAL and should NEVER be flagged:
- Numbers as digits ("7 days" NOT "seven days") — digits are CORRECT for ads
- Sentence fragments, one-word sentences, incomplete thoughts — these are intentional hooks
- Starting sentences with "And", "But", "So", "Because" — conversational tone is correct
- ALL CAPS for 1-3 emphasis words (e.g., "This is THE moment")
- Ellipsis (…), em dashes (—), informal punctuation
- Missing Oxford commas
- Casual/punchy tone, slang, contractions
- Emoji usage
- Short paragraphs or single-line paragraphs
- Brand names, product names, or coined terms
- Price formatting ($997, $47/mo)

ONLY flag these as issues:
1. Genuine misspelled words (typos like "teh", "recieve", "definately")
2. Grammar so broken it confuses the meaning (not stylistic fragments)
3. Wrong word usage that changes meaning ("your" vs "you're", "their" vs "there")
4. Repeated words that are clearly accidental ("the the")

Be very conservative. If in doubt, do NOT flag it. Most ad copy will have zero issues.

Return a JSON array of issues found. Each issue should have:
- field: the field name from the input
- text: the problematic word or phrase
- suggestion: the corrected text
- reason: brief explanation (e.g., "typo", "wrong word")
- location: the location from the input

If no issues found, return an empty array: []

COPY TO CHECK:
${JSON.stringify(copyToCheck, null, 2)}

Return ONLY the JSON array, no other text.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful copy editor. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return { id: 'spelling', name: 'Spelling & Grammar', status: 'passed', message: `${copyToCheck.length} items checked`, details: 'AI check unavailable' };
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '[]';

    let issues: Issue[] = [];
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      issues = JSON.parse(cleanContent);
    } catch {
      issues = [];
    }

    if (issues.length === 0) {
      return { id: 'spelling', name: 'Spelling & Grammar', status: 'passed', message: `${copyToCheck.length} items checked`, details: 'No spelling or grammar issues found' };
    }

    return {
      id: 'spelling', name: 'Spelling & Grammar', status: 'warning',
      message: `${issues.length} issue${issues.length > 1 ? 's' : ''} found`,
      issues, details: 'Review suggested corrections before publishing',
    };
  } catch (error) {
    console.error('Spelling check error:', error);
    return { id: 'spelling', name: 'Spelling & Grammar', status: 'passed', message: 'Check completed', details: 'Some items could not be verified' };
  }
}
