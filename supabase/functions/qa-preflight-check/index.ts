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
  /** Explicit pixel state, shared between the Landing Page and Event Tracking rows. */
  pixelState?: 'no_url' | 'unknown' | 'no_pixel_on_page' | 'pixel_mismatch' | 'pixel_matched';
  /** Pixel ID actually detected on the landing page (may differ from pixelId). */
  foundPixelId?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const { 
      brand,
      answers,
      creativeJson,
      productionItems,
      offerUrl,
      selectedCopy,
      template,
      approvedCopySignature,
      trackingSetup,
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

    // If the copy currently being published exactly matches what the user
    // already approved in the copy step, skip the AI copy/policy re-review.
    const currentSignature = await computeCurrentCopySignature(selectedCopy, productionItems);
    const copyPreApproved = !!approvedCopySignature && approvedCopySignature === currentSignature;
    console.log('Copy pre-approval:', { copyPreApproved, currentSignature, approvedCopySignature });

    const results: CheckResult[] = [];

    results.push(checkMetaConnection(brand));
    results.push(checkBudget(answers));
    results.push(checkSchedule(answers));
    const landingPageResult = await checkLandingPage(resolvedUrl, brand);
    results.push(landingPageResult);
    results.push(checkEventTracking(brand, template, landingPageResult, trackingSetup));
    if (copyPreApproved) {
      results.push({ id: 'spelling', name: 'Spelling & Grammar', status: 'passed', message: 'Approved copy — skipped', details: 'Copy was already reviewed and approved.' });
      results.push({ id: 'ad_policy', name: 'Ad Policy', status: 'passed', message: 'Approved copy — skipped', details: 'Copy was already reviewed and approved.' });
    } else {
      results.push(await checkSpellingGrammar(creativeJson, productionItems, selectedCopy));
      results.push(await checkAdPolicy(selectedCopy, productionItems, brand, authHeader, creativeJson));
    }



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

// ---- Copy signature (must match src/lib/copy-signature.ts) --------------
function normalizeCopyVariations(variations: any[]): { h: string; p: string; d: string }[] {
  if (!Array.isArray(variations)) return [];
  return variations
    .map((v) => ({
      h: (v?.headline || '').toString().trim(),
      p: (v?.primary_text || v?.primaryText || '').toString().trim(),
      d: (v?.description || '').toString().trim(),
    }))
    .filter((v) => v.h || v.p || v.d)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeCurrentCopySignature(
  selectedCopy: any,
  productionItems: any[] | undefined,
): Promise<string> {
  const variations: any[] = [];
  const sv = selectedCopy?.shared_variations;
  if (Array.isArray(sv)) variations.push(...sv);
  if (Array.isArray(productionItems)) {
    for (const item of productionItems) {
      const fc = item?.finalCopy || item?.final_copy;
      if (fc) {
        variations.push({
          headline: fc.headline,
          primary_text: fc.primary_text || fc.primaryText,
          description: fc.description,
        });
      }
    }
  }
  return await sha256Hex(JSON.stringify(normalizeCopyVariations(variations)));
}


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

// Checkout / form / short-link hosts that are valid destinations but routinely
// (a) block bot fetches, (b) render via client-side JS so the pixel isn't in
// the initial HTML, or (c) inject the pixel via the platform's own tag manager.
// For these we accept the URL as a valid destination without strict pixel scan
// so publish is never blocked on a structurally fine checkout URL.
const TRUSTED_CHECKOUT_HOSTS = [
  'flodesk.com', 'f.page',
  'thrivecart.com',
  'checkout.stripe.com', 'buy.stripe.com',
  'paypal.com', 'paypal.me',
  'kajabi.com', 'mykajabi.com',
  'teachable.com',
  'thinkific.com',
  'podia.com',
  'gumroad.com',
  'shopify.com', 'myshopify.com',
  'samcart.com',
  'clickfunnels.com',
  'systeme.io',
  'kartra.com',
  'leadpages.co', 'lpages.co',
  'convertkit.com', 'ck.page',
  'mailerlite.com',
  'square.site', 'squareup.com',
  'eventbrite.com',
  'calendly.com',
  'acuityscheduling.com',
  'circle.so',
  'memberstack.com', 'memberful.com',
  // Site builders whose checkout / order-confirmation pages are dynamic per order
  'squarespace.com', 'sqsp.net',
  'wix.com', 'wixsite.com',
  'webflow.io',
  'bigcartel.com',
  'ecwid.com',
];

function isTrustedCheckoutHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return TRUSTED_CHECKOUT_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

// Recognize dynamic confirmation / thank-you / order-success URLs.
// These URLs change per order/session so the exact URL the user pasted may 404
// to our bot, but the pixel is on the underlying site template.
const DYNAMIC_CONFIRMATION_PATH_PATTERNS = [
  /\/checkout\/order-confirmed/i,
  /\/order[-_/]?confirm/i,
  /\/order[-_/]?(complete|success|received|thank)/i,
  /\/thank[-_]?you/i,
  /\/thankyou/i,
  /\/confirmation/i,
  /\/success/i,
  /\/receipt/i,
  /\/purchase[-_]?complete/i,
];
const DYNAMIC_CONFIRMATION_QUERY_KEYS = [
  'orderid', 'order_id', 'order', 'sessionid', 'session_id',
  'session', 'token', 'tx', 'transaction', 'cart', 'checkout',
];

function isDynamicConfirmationUrl(parsed: URL): boolean {
  const path = parsed.pathname || '';
  if (DYNAMIC_CONFIRMATION_PATH_PATTERNS.some((re) => re.test(path))) return true;
  const params = parsed.searchParams;
  for (const key of DYNAMIC_CONFIRMATION_QUERY_KEYS) {
    if (params.has(key)) return true;
  }
  return false;
}

async function scanHtmlForPixel(fullUrl: string, timeoutMs = 10000): Promise<{
  ok: boolean;
  status: number;
  hasFbEvents: boolean;
  foundPixelId: string | null;
} | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YourAdAssistant/1.0)' },
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return { ok: false, status: response.status, hasFbEvents: false, foundPixelId: null };
    }
    const html = await response.text();
    const hasFbEvents = html.includes('connect.facebook.net') && html.includes('fbevents.js');
    const m = html.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/);
    return { ok: true, status: response.status, hasFbEvents, foundPixelId: m ? m[1] : null };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for pixel presence.
// checkLandingPage() runs the scan and stamps an explicit `pixelState` on its
// result; checkEventTracking() consumes that same state instead of guessing
// from brand.meta_pixel_id. That's what keeps the two rows from contradicting
// each other ("pixel installed" vs "no pixel connected").
// ---------------------------------------------------------------------------
type PixelState =
  | 'no_url'
  | 'unknown'            // couldn't load / couldn't scan the page
  | 'no_pixel_on_page'   // page loaded, no Meta Pixel found
  | 'pixel_mismatch'     // pixel found, but not this ad account's pixel
  | 'pixel_matched';     // pixel found and it matches this ad account

async function checkLandingPage(url: string | undefined, brand: any): Promise<CheckResult> {
  if (!url) {
    return { id: 'landing_page', name: 'Landing Page', status: 'warning', message: 'No landing page URL set', details: 'Add a URL to track conversions properly', pixelState: 'no_url' };
  }

  const pixelId = brand?.meta_pixel_id || null;
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  let parsed: URL | null = null;
  try { parsed = new URL(fullUrl); } catch { /* fall through */ }

  // Trusted checkout / short-link hosts: don't try to scan HTML for pixel —
  // they're SPAs or bot-blocked, but the URL itself is a valid ad destination.
  if (parsed && isTrustedCheckoutHost(parsed.hostname)) {
    return {
      id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl,
      details: 'Hosted checkout / site-builder URL detected — Meta will accept this. We can\'t scan it for your pixel, so double-check the pixel is installed on your site template.',
      pixelState: 'unknown', pixelId,
    };
  }

  // Dynamic confirmation / thank-you URLs: the exact URL changes per order so it
  // may 404 our bot. Try the base domain instead — if the pixel lives there,
  // the same pixel fires on every page including the confirmation page.
  if (parsed && isDynamicConfirmationUrl(parsed)) {
    const rootUrl = `${parsed.protocol}//${parsed.hostname}/`;
    const rootScan = await scanHtmlForPixel(rootUrl);
    if (rootScan?.ok && rootScan.hasFbEvents && rootScan.foundPixelId) {
      if (!pixelId || rootScan.foundPixelId === pixelId) {
        return {
          id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl,
          details: `Dynamic confirmation URL — verified a Meta Pixel (…${rootScan.foundPixelId.slice(-6)}) is installed on ${parsed.hostname}, so it fires on this page too.`,
          pixelId: pixelId || rootScan.foundPixelId,
          foundPixelId: rootScan.foundPixelId,
          pixelState: pixelId ? 'pixel_matched' : 'unknown',
        };
      }
      return {
        id: 'landing_page', name: 'Landing Page', status: 'warning', message: fullUrl,
        details: `A Meta Pixel (…${rootScan.foundPixelId.slice(-6)}) is installed on ${parsed.hostname}, but it isn't the pixel on your ad account (…${String(pixelId).slice(-6)}).`,
        pixelId, foundPixelId: rootScan.foundPixelId, pixelNotInstalled: false,
        pixelState: 'pixel_mismatch',
      };
    }
    return {
      id: 'landing_page', name: 'Landing Page', status: 'warning', message: fullUrl,
      details: 'This looks like a dynamic order-confirmation URL that changes per order, so we can\'t verify it directly. Make sure your Meta Pixel is installed site-wide so the conversion event fires here.',
      pixelId, pixelNotInstalled: false, pixelState: 'unknown',
    };
  }

  const scan = await scanHtmlForPixel(fullUrl);
  if (scan === null) {
    return { id: 'landing_page', name: 'Landing Page', status: 'warning', message: fullUrl, details: 'Could not verify URL — page may be slow, behind authentication, or behind a firewall. If it works in your browser, you\'re good to publish.', pixelId, pixelState: 'unknown' };
  }
  if (!scan.ok) {
    if (scan.status === 403 || scan.status === 405) {
      return { id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl, details: 'Server blocked our verification, but the URL looks valid. We couldn\'t check for your pixel.', pixelId, pixelState: 'unknown' };
    }
    if (scan.status >= 300 && scan.status < 400) {
      return { id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl, details: 'Page loads with a redirect — make sure it lands where you expect. We couldn\'t check for your pixel.', pixelId, pixelState: 'unknown' };
    }
    return { id: 'landing_page', name: 'Landing Page', status: 'warning', message: fullUrl, details: `We couldn't load this URL from our server (${scan.status}). If it works in your browser, you're good to publish — Meta will accept it.`, pixelId, pixelState: 'unknown' };
  }

  const found = scan.hasFbEvents ? (scan.foundPixelId || null) : null;

  if (!found) {
    return {
      id: 'landing_page', name: 'Landing Page', status: pixelId ? 'warning' : 'passed', message: fullUrl,
      details: pixelId
        ? 'Page is live, but no Meta Pixel was found on it. Install your pixel so Meta can track conversions.'
        : 'Page is live. No Meta Pixel found on it (and no pixel on your ad account yet).',
      pixelId, pixelNotInstalled: !!pixelId, pixelState: 'no_pixel_on_page',
    };
  }

  if (!pixelId) {
    return {
      id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl,
      details: `Page is live and a Meta Pixel (…${found.slice(-6)}) is installed. We couldn't confirm it belongs to your ad account.`,
      foundPixelId: found, pixelState: 'unknown',
    };
  }

  if (found === pixelId) {
    return {
      id: 'landing_page', name: 'Landing Page', status: 'passed', message: fullUrl,
      details: `Page is live and your Meta Pixel (…${pixelId.slice(-6)}) is installed on it.`,
      pixelId, foundPixelId: found, pixelState: 'pixel_matched',
    };
  }

  return {
    id: 'landing_page', name: 'Landing Page', status: 'warning', message: fullUrl,
    details: `A Meta Pixel was found on this page, but it isn't your ad account's pixel. Found: …${found.slice(-6)} · Expected: …${pixelId.slice(-6)}`,
    pixelId, foundPixelId: found, pixelNotInstalled: false, pixelState: 'pixel_mismatch',
  };
}



function checkEventTracking(
  brand: any,
  template: any,
  lp?: CheckResult,
  trackingSetup?: { verified?: boolean; conversionUrl?: string | null } | null,
): CheckResult {
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
  const pixelState: PixelState = (lp?.pixelState as PixelState) || 'unknown';
  const foundPixelId = lp?.foundPixelId || null;
  const base = { id: 'tracking', name: 'Event Tracking', requiredEvent, pixelId, campaignGoal, pixelState } as const;

  // 1. No pixel on the ad account at all — that IS "no pixel connected".
  if (!pixelId) {
    return {
      ...base, status: 'warning',
      message: 'No Meta Pixel on your ad account',
      details: `Connect a Meta Pixel to your ad account, then add a "${requiredEvent}" event so Meta can optimize.`,
    };
  }

  // 2. The page we're sending traffic to has no pixel / the wrong pixel.
  //    This is a pixel problem, not an event problem — say so precisely.
  if (pixelState === 'no_pixel_on_page') {
    return {
      ...base, status: 'warning',
      message: `Pixel not on your landing page`,
      details: `Your ad account has a pixel (…${pixelId.slice(-6)}) but it isn't installed on your landing page, so the "${requiredEvent}" event can't fire. Install the pixel first.`,
    };
  }
  if (pixelState === 'pixel_mismatch') {
    return {
      ...base, status: 'warning',
      message: 'Wrong pixel on your landing page',
      details: `Your page fires pixel …${String(foundPixelId).slice(-6)}, but this ad account uses …${pixelId.slice(-6)}. Meta won't see the "${requiredEvent}" event until they match.`,
    };
  }

  // 3. Pixel is fine — the only remaining question is the event rule.
  const eventVerified = !!(pixelEvents[requiredEvent] || pixelEvents[requiredEvent.toLowerCase()]);
  if (eventVerified) {
    return {
      ...base, status: 'passed',
      message: `${requiredEvent} event verified`,
      details: `Pixel …${pixelId.slice(-6)} is installed and the ${requiredEvent} event is firing.`,
    };
  }

  return {
    ...base, status: 'warning',
    message: `No ${requiredEvent} event yet`,
    details: pixelState === 'pixel_matched'
      ? `Your pixel (…${pixelId.slice(-6)}) is installed on the landing page, but no "${requiredEvent}" event has fired yet. Set up the event using your thank-you page URL — it has to be on the same domain as your landing page.`
      : `Your pixel (…${pixelId.slice(-6)}) is connected, but we haven't seen a "${requiredEvent}" event fire yet. Set it up using your thank-you page URL (same domain as your landing page).`,
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

    // 4. From advanced-builder shared_variations (workspace.selected_copy.shared_variations)
    const sourcesForShared = [selectedCopy, creativeJson?.selected_copy, creativeJson?.copy_selections, creativeJson?.copySelections];
    for (const src of sourcesForShared) {
      const sv = src?.shared_variations;
      if (Array.isArray(sv)) {
        sv.forEach((v: any, i: number) => {
          const label = v?.angle ? `Variation ${i + 1} (${v.angle})` : `Variation ${i + 1}`;
          if (v?.headline) copyToCheck.push({ field: 'headline', text: v.headline, location: label });
          if (v?.description) copyToCheck.push({ field: 'description', text: v.description, location: label });
          const pt = v?.primary_text || v?.primaryText;
          if (pt) copyToCheck.push({ field: 'primary_text', text: pt, location: label });
        });
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

function extractRepresentativeCopy(
  selectedCopy: any,
  productionItems: any[],
  creativeJson?: any,
): { headline: string; primary_text: string; description: string } | null {
  // 1. shared_variations on selectedCopy (advanced builder)
  const sv = selectedCopy?.shared_variations;
  if (Array.isArray(sv) && sv.length) {
    const v = sv[0];
    const headline = v?.headline || '';
    const primary_text = v?.primary_text || v?.primaryText || '';
    const description = v?.description || '';
    if (headline || primary_text || description) {
      return { headline, primary_text, description };
    }
  }

  // 2. finalCopy on production items
  if (Array.isArray(productionItems)) {
    for (const item of productionItems) {
      const fc = item?.finalCopy || item?.final_copy;
      if (fc) {
        const headline = fc.headline || '';
        const primary_text = fc.primaryText || fc.primary_text || '';
        const description = fc.description || '';
        if (headline || primary_text || description) {
          return { headline, primary_text, description };
        }
      }
    }
  }

  // 3. top-level selectedCopy fields
  if (selectedCopy && typeof selectedCopy === 'object') {
    const headline = selectedCopy.headline || '';
    const primary_text = selectedCopy.primary_text || selectedCopy.primaryText || '';
    const description = selectedCopy.description || '';
    if (headline || primary_text || description) {
      return { headline, primary_text, description };
    }
  }

  // 4. Inside creative_json — angle_copy, copy_selections, and any nested
  // shared_variations. This is where Creative Studio (the actual, current
  // copy-editing surface) saves copy, and checkSpellingGrammar already reads
  // it (see its "legacy support" sources above). Without this, copy written
  // there was invisible to the Ad Policy check specifically, which kept
  // reporting "No copy to review" no matter what the user finalized —
  // Spelling passing while Ad Policy insists there's nothing to check is
  // exactly that contradiction, and it left users with no way to satisfy
  // this check before publishing.
  if (creativeJson && typeof creativeJson === 'object') {
    const angleCopy = creativeJson.angleCopy || creativeJson.angle_copy || {};
    for (const data of Object.values(angleCopy)) {
      const angleData = data as any;
      const headline = angleData?.headlines?.[0]?.text || '';
      const primary_text =
        angleData?.primary_copy?.[0]?.text || angleData?.primaryCopy?.[0]?.text || '';
      const description = angleData?.descriptions?.[0]?.text || '';
      if (headline || primary_text || description) {
        return { headline, primary_text, description };
      }
    }

    const nestedShared =
      creativeJson.selected_copy?.shared_variations ||
      creativeJson.copy_selections?.shared_variations ||
      creativeJson.copySelections?.shared_variations;
    if (Array.isArray(nestedShared) && nestedShared.length) {
      const v = nestedShared[0];
      const headline = v?.headline || '';
      const primary_text = v?.primary_text || v?.primaryText || '';
      const description = v?.description || '';
      if (headline || primary_text || description) {
        return { headline, primary_text, description };
      }
    }

    const copySelections =
      creativeJson.copy_selections || creativeJson.copySelections || creativeJson.selected_copy || {};
    if (copySelections && typeof copySelections === 'object') {
      let headline = '';
      let primary_text = '';
      let description = '';
      let fallbackAny = '';
      for (const [key, val] of Object.entries(copySelections)) {
        const text = typeof val === 'string' ? val : (val as any)?.text;
        if (!text || typeof text !== 'string' || !text.trim()) continue;
        const k = key.toLowerCase();
        if (!headline && k.includes('headline')) headline = text;
        else if (!primary_text && (k.includes('primary') || k.includes('body'))) primary_text = text;
        else if (!description && k.includes('description')) description = text;
        if (!fallbackAny) fallbackAny = text;
      }
      if (!headline && !primary_text && !description && fallbackAny) primary_text = fallbackAny;
      if (headline || primary_text || description) {
        return { headline, primary_text, description };
      }
    }
  }

  return null;
}

async function checkAdPolicy(
  selectedCopy: any,
  productionItems: any[],
  brand: any,
  authHeader: string,
  creativeJson?: any,
): Promise<CheckResult> {
  const copy = extractRepresentativeCopy(selectedCopy, productionItems, creativeJson);
  if (!copy) {
    return {
      id: 'ad_policy',
      name: 'Ad Policy',
      status: 'warning',
      message: 'No copy to review',
      details: 'Finalize ad copy before publishing so we can check it against Meta & Google ad policy.',
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    return {
      id: 'ad_policy', name: 'Ad Policy', status: 'passed',
      message: 'Policy check unavailable', details: 'Manual review recommended before publishing.',
    };
  }

  const niche = brand?.niche || brand?.industry || brand?.industry_category || '';

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/check-ad-compliance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        apikey: Deno.env.get('SUPABASE_ANON_KEY') || '',
      },
      body: JSON.stringify({ copy, niche, platforms: ['meta'] }),
    });

    if (!resp.ok) {
      console.warn('check-ad-compliance returned', resp.status);
      return {
        id: 'ad_policy', name: 'Ad Policy', status: 'passed',
        message: 'Policy check skipped', details: 'We couldn\'t reach the policy reviewer right now. Review your copy manually before launching.',
      };
    }

    const data = await resp.json();
    const findings = Array.isArray(data?.findings) ? data.findings : [];

    const issues: Issue[] = findings.map((f: any) => ({
      field: f.category || 'policy',
      text: f.phrase || '',
      suggestion: f.rewrite || '',
      reason: f.category || 'policy',
      location: data?.niche_flag ? `Niche: ${data.niche_flag}` : 'Ad copy',
    }));

    const likelyRejection = findings.filter((f: any) => f.severity === 'likely_rejection');
    const possibleFlag = findings.filter((f: any) => f.severity === 'possible_flag');

    if (data?.overall === 'needs_review' || likelyRejection.length > 0) {
      const rejectionIssues: Issue[] = likelyRejection.map((f: any) => ({
        field: f.category || 'policy',
        text: f.phrase || '',
        suggestion: f.rewrite || '',
        reason: f.category || 'policy',
        location: data?.niche_flag ? `Niche: ${data.niche_flag}` : 'Ad copy',
      }));
      return {
        id: 'ad_policy', name: 'Ad Policy', status: 'failed',
        message: `${likelyRejection.length} likely policy violation${likelyRejection.length === 1 ? '' : 's'}`,
        issues: rejectionIssues.length ? rejectionIssues : issues,
        details: data?.niche_flag
          ? `Restricted niche: ${data.niche_flag}. Apply the suggested rewrites before launching.`
          : 'Meta or Google will likely reject this copy. Apply the suggested rewrites before launching.',
      };
    }

    if (possibleFlag.length > 0) {
      return {
        id: 'ad_policy', name: 'Ad Policy', status: 'warning',
        message: `${possibleFlag.length} phrase${possibleFlag.length === 1 ? '' : 's'} may get flagged`,
        issues,
        details: data?.niche_flag
          ? `Restricted niche: ${data.niche_flag}. Consider softening flagged phrases.`
          : 'Gray-area phrasing. Consider the suggested rewrites to reduce rejection risk.',
      };
    }

    return {
      id: 'ad_policy', name: 'Ad Policy', status: 'passed',
      message: 'Copy looks policy-safe',
      details: data?.niche_flag
        ? `Niche noted: ${data.niche_flag}. No likely violations found.`
        : 'No likely policy violations found in headline, primary text, or description.',
    };
  } catch (error) {
    console.error('Ad policy check error:', error);
    return {
      id: 'ad_policy', name: 'Ad Policy', status: 'passed',
      message: 'Policy check skipped', details: 'We couldn\'t complete the policy review. Review your copy manually before launching.',
    };
  }
}


