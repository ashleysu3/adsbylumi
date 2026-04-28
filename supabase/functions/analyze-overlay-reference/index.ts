import { getCorsHeaders } from '../_shared/cors.ts';

// ============================================================================
// analyze-overlay-reference
//
// Admin-only endpoint: takes a single frame (base64 PNG) captured from a
// reference video, sends it to Gemini 2.5 Flash via the Lovable AI gateway
// with a structured prompt, and returns a JSON-shaped style spec the
// Overlay Templates admin form can pre-fill.
//
// The goal is "Ashley drops in an Instagram clip → she gets a draft
// template in seconds instead of filling the form by hand." Output is
// always a draft — admin reviews + tweaks + saves. We don't save templates
// directly here.
//
// Only font/color/position/case/stroke are extracted. Font detection is
// genuinely hard (Meta/IG doesn't embed font names; visual guessing is
// imperfect) so we constrain the output to LUMI's known font options and
// mark confidence low when the match is uncertain.
// ============================================================================

const ALLOWED_FONTS = [
  'Inter',
  'Playfair Display',
  'Montserrat',
  'Bebas Neue',
  'Poppins',
  'Oswald',
  'Lora',
  'Raleway',
] as const;

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return json({ error: 'Missing imageBase64 (PNG data URL or base64 string)' }, 400, corsHeaders);
    }

    // Accept either a full data URL or a raw base64 string. Normalize to
    // the data-URL form Lovable / Gemini expects.
    const imageUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return json({ error: 'LOVABLE_API_KEY not configured on this deployment' }, 500, corsHeaders);
    }

    const prompt = buildPrompt();

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are a visual design analyst specializing in text overlays on short-form social video. Return ONLY valid JSON matching the schema in the user prompt — no prose, no code fences.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '');
      console.error('[analyze-overlay-reference] AI gateway error:', aiRes.status, errText);
      return json({ error: `AI analysis failed (${aiRes.status})` }, 502, corsHeaders);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content ?? '';

    // Gemini occasionally wraps JSON in code fences despite instructions;
    // strip them defensively before parsing.
    const cleaned = String(raw)
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error('[analyze-overlay-reference] JSON parse failed:', cleaned.slice(0, 300));
      return json(
        { error: 'AI returned unparseable output. Try a different frame or fill in the form manually.' },
        502,
        corsHeaders,
      );
    }

    const validated = validateAndClamp(parsed);
    return json({ success: true, draft: validated }, 200, corsHeaders);
  } catch (error: any) {
    console.error('analyze-overlay-reference error:', error);
    return json({ error: error?.message || 'Unknown error' }, 500, getCorsHeaders(req.headers.get('origin')));
  }
});

function json(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function buildPrompt(): string {
  return `Analyze the text overlay style on the attached video frame. This frame was pulled from an Instagram / short-form social clip that someone wants to use as a style reference for a text-on-b-roll template.

Produce a JSON object with these exact keys and constrained value types:

{
  "name_suggestion": string,                // short 2-4 word template name you'd use, capturing the vibe
  "description_suggestion": string,         // one sentence describing the style
  "font_family": one of [${ALLOWED_FONTS.map(f => `"${f}"`).join(', ')}],   // pick the closest match from this set only
  "font_size": integer between 24 and 96,   // in px, assuming a 1080x1920 reference
  "font_weight": "normal" | "bold" | "black",
  "text_color": string,                     // hex "#RRGGBB"
  "bg_color": string,                       // hex "#RRGGBB" for background bar if present; if no bar, use "#000000"
  "bg_opacity": number between 0 and 1,     // 0 if no visible background bar; 1 if solid opaque bar
  "position": "top" | "center" | "bottom",  // where in the frame the text sits
  "text_shadow": boolean,                   // true if a drop shadow is visible
  "letter_case": "as-typed" | "upper" | "lower" | "title",
  "text_stroke_color": null | string,       // hex if the text has an outline/stroke, else null
  "text_stroke_width": integer between 0 and 12,   // 0 if no stroke
  "confidence_notes": string                 // 1-2 sentences on how confident you are and what might be wrong
}

Guidance:
- If the frame doesn't appear to have text, say so in confidence_notes and pick sensible defaults.
- Font identification is approximate — pick the closest from the allowed list. Prefer Bebas Neue for condensed bold uppercase, Inter for modern sans, Playfair Display / Lora for serifs, Oswald for condensed, Montserrat / Poppins / Raleway for mid-weight sans.
- Use "upper" / "lower" / "title" only when ALL the text in the frame is in that case. Otherwise use "as-typed".
- If there's a colored bar behind the text, set bg_color to that color and pick an opacity by eye (solid = 1, faint = 0.3).
- Stroke color should only be set if there's a visible outline distinct from a drop shadow.

Return ONLY the JSON object. No prose, no markdown fences.`;
}

function validateAndClamp(parsed: any): Record<string, any> {
  const clampNum = (v: any, min: number, max: number, fallback: number): number => {
    const n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  const fromSet = <T extends string>(v: any, set: readonly T[], fallback: T): T =>
    (set as readonly string[]).includes(String(v)) ? (v as T) : fallback;
  const hex = (v: any, fallback: string): string =>
    typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : fallback;

  return {
    name_suggestion: typeof parsed?.name_suggestion === 'string' ? parsed.name_suggestion.slice(0, 60) : 'Reference Style',
    description_suggestion:
      typeof parsed?.description_suggestion === 'string' ? parsed.description_suggestion.slice(0, 280) : '',
    font_family: fromSet(parsed?.font_family, ALLOWED_FONTS, 'Inter'),
    font_size: Math.round(clampNum(parsed?.font_size, 24, 96, 48)),
    font_weight: fromSet(parsed?.font_weight, ['normal', 'bold', 'black'] as const, 'bold'),
    text_color: hex(parsed?.text_color, '#FFFFFF'),
    bg_color: hex(parsed?.bg_color, '#000000'),
    bg_opacity: Math.round(clampNum(parsed?.bg_opacity, 0, 1, 0.6) * 100) / 100,
    position: fromSet(parsed?.position, ['top', 'center', 'bottom'] as const, 'bottom'),
    text_shadow: Boolean(parsed?.text_shadow),
    letter_case: fromSet(parsed?.letter_case, ['as-typed', 'upper', 'lower', 'title'] as const, 'as-typed'),
    text_stroke_color: parsed?.text_stroke_color && /^#[0-9A-Fa-f]{6}$/.test(parsed.text_stroke_color)
      ? parsed.text_stroke_color
      : null,
    text_stroke_width: Math.round(clampNum(parsed?.text_stroke_width, 0, 12, 0)),
    confidence_notes: typeof parsed?.confidence_notes === 'string' ? parsed.confidence_notes.slice(0, 400) : '',
  };
}
