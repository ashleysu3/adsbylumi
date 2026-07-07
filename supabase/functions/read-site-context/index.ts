import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuthedUser } from '../_shared/check-subscription.ts';

// Reads a brand's website the way a human would — via the engine's real
// headless browser (ENGINE_URL + /read-site), which renders pages that raw
// HTML fetches get 403'd on (Cloudflare/Wix/Showit etc.), and visits the
// About / Work-with-me / Offers / Results pages, not just the homepage.
//
// That multi-page context (real text + real screenshots) is fed to a vision
// model to produce a MUCH juicier, better-grounded audience_psychology than
// generate-audience-psychology's single-homepage-fetch can — that's the whole
// point: the "who I serve / my story / my results" content lives on those
// inner pages, not the homepage hero.
//
// Designed to be a pure ENRICHMENT, never a regression: if the engine can't
// read the site (not deployed yet, site unreachable, no pages captured), this
// returns { skipped: true } and touches nothing — the existing
// generate-audience-psychology / analyze-brand-voice pipeline remains the
// source of truth. When it succeeds, its result is strictly richer and
// overwrites audience_psychology; it only fills target_audience if the user
// hasn't already typed their own (their explicit input always wins).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => typeof id === 'string' && UUID_REGEX.test(id);

const ENGINE_URL = Deno.env.get('ENGINE_URL') ?? '';
const ENGINE_KEY = Deno.env.get('LUMI_ENGINE_KEY') ?? '';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';

// Label order controls which pages we keep if the engine returns more than
// we want to send to the vision model (cost/latency control).
const PAGE_PRIORITY = ['home', 'about', 'offers', 'results'];
const MAX_IMAGES = 2; // home + one inner page — keeps the vision call fast & cheap
const MAX_TEXT_CHARS_PER_PAGE = 3500;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!ENGINE_URL) {
      return json(corsHeaders, 200, { skipped: true, reason: 'engine_not_configured' });
    }
    if (!LOVABLE_API_KEY) {
      return json(corsHeaders, 200, { skipped: true, reason: 'ai_not_configured' });
    }

    const gate = await requireAuthedUser(req, corsHeaders);
    if (gate.blocked) return gate.blocked;
    const userId = gate.userId!;

    const { brandId } = await req.json();
    if (!brandId || !isValidUUID(brandId)) {
      return json(corsHeaders, 400, { error: 'valid brandId is required' });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .maybeSingle();
    if (brandError || !brand) return json(corsHeaders, 404, { error: 'Brand not found' });
    if (brand.user_id !== userId) return json(corsHeaders, 403, { error: 'Access denied' });

    const websiteUrl = brand.website_url as string | null;
    if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) {
      return json(corsHeaders, 200, { skipped: true, reason: 'no_website_url' });
    }

    // --- 1) Read the site like a human, via the engine's real browser ---
    let pages: Array<{ url: string; label: string; screenshot: string; text: string }> = [];
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45_000);
      const r = await fetch(`${ENGINE_URL.replace(/\/$/, '')}/read-site`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': ENGINE_KEY },
        body: JSON.stringify({ url: websiteUrl, maxPages: 4 }),
      });
      clearTimeout(t);
      if (r.ok) {
        const data = await r.json();
        pages = Array.isArray(data?.pages) ? data.pages : [];
      } else {
        console.warn('read-site-context: engine /read-site failed', r.status);
      }
    } catch (e) {
      console.warn('read-site-context: engine call failed', (e as any)?.message || e);
    }

    if (!pages.length) {
      // Engine couldn't read it either (not deployed yet, site down, etc.) —
      // leave the existing generate-audience-psychology result untouched.
      return json(corsHeaders, 200, { skipped: true, reason: 'no_pages_captured' });
    }

    pages.sort((a, b) => PAGE_PRIORITY.indexOf(a.label) - PAGE_PRIORITY.indexOf(b.label));

    // --- 2) Build the multimodal prompt: real multi-page text + real screenshots ---
    const textBlock = pages
      .map((p) => `--- PAGE: ${p.label.toUpperCase()} (${p.url}) ---\n${(p.text || '').slice(0, MAX_TEXT_CHARS_PER_PAGE)}`)
      .join('\n\n');

    const images = pages.slice(0, MAX_IMAGES).filter((p) => p.screenshot);

    const systemPrompt = `You are an expert in audience psychology and conversion copywriting for direct-response Meta ads.

Your job: produce a SPECIFIC, GROUNDED audience profile from the REAL multi-page content below (homepage + about/offers/results pages, rendered from the live site) plus the attached screenshots. NOT a generic "busy entrepreneur" sketch, and NEVER an invented industry/niche that isn't supported by the source.

GROUNDING RULES (most important):
- Every pain point, desire, and objection MUST reference something in the page text below. Quote or closely paraphrase real language from the site — founder bios, offer descriptions, testimonials, results claims.
- Be uncomfortably specific: name the exact niche/industry the brand serves (it's usually stated plainly on the About or Offers page), the specific transformation promised, the specific proof shown.
- Never use marketing clichés ("take their business to the next level", "live their dream life", "unlock their potential").
- Use the screenshots to sense the brand's visual personality (color palette, type style, mood — editorial vs playful, minimal vs maximal, warm vs bold) and let that inform the "visual_identity" field.

Return ONLY a valid JSON object with these exact fields:
{
  "demographics": "string",
  "psychographics": "string",
  "pain_points": ["string", ...],
  "desires": ["string", ...],
  "objections": ["string", ...],
  "motivations": "string",
  "summary": "string — 3-4 sentences briefing a copywriter on this exact audience, ending with the single most important emotional truth",
  "target_audience": "string — one punchy line naming exactly who this brand serves, grounded in the source (e.g. 'Amazon creators scaling shipped revenue past the plateau')",
  "visual_identity": "string — one sentence on the brand's visual personality/aesthetic from the screenshots (palette, type feel, mood)"
}

Tone: warm, clever, strategic. Never robotic, never hype.`;

    const userContent: any[] = [
      {
        type: 'text',
        text: `BRAND: ${brand.name || 'Unknown'}\nWEBSITE: ${websiteUrl}\nWHAT THEY SAY THEY OFFER: ${brand.value_proposition || 'Not specified'}\n\n=== REAL PAGE CONTENT (primary source — quote from this) ===\n${textBlock}\n\nBuild the grounded psychological profile now. Name the real niche/industry — don't guess a different one.`,
      },
      ...images.map((p) => ({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${p.screenshot}` },
      })),
    ];

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => '');
      console.warn('read-site-context: AI call failed', aiResponse.status, errText.slice(0, 300));
      return json(corsHeaders, 200, { skipped: true, reason: 'ai_call_failed' });
    }

    const aiData = await aiResponse.json();
    const content =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ??
      '';
    if (!content) return json(corsHeaders, 200, { skipped: true, reason: 'empty_ai_response' });

    let psychology: any;
    try {
      const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? content).trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      psychology = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch (e) {
      console.warn('read-site-context: failed to parse AI JSON', (e as any)?.message);
      return json(corsHeaders, 200, { skipped: true, reason: 'unparseable_ai_response' });
    }

    psychology._source = 'read_site_vision';
    psychology._pages_read = pages.map((p) => p.label);

    // --- 3) Persist: overwrite audience_psychology (strictly richer); only
    // fill target_audience if the user hasn't already told us themselves. ---
    const dbPatch: Record<string, unknown> = {
      audience_psychology: psychology,
      psychology_status: 'completed',
      psychology_generated_at: new Date().toISOString(),
    };
    if (!brand.target_audience && psychology.target_audience) {
      dbPatch.target_audience = psychology.target_audience;
    }

    const { error: updateError } = await supabase.from('brands').update(dbPatch).eq('id', brandId);
    if (updateError) throw updateError;

    return json(corsHeaders, 200, { success: true, psychology, pagesRead: psychology._pages_read });
  } catch (error: any) {
    console.error('Error in read-site-context:', error);
    // Never fail loudly — this is an enrichment layer, not the source of truth.
    return json(getCorsHeaders(req.headers.get('origin')), 200, { skipped: true, reason: 'internal_error' });
  }
});

function json(corsHeaders: Record<string, string>, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
