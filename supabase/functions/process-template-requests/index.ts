import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MAX_BATCH = 3;
const MAX_ATTEMPTS = 3;
const LOCK_STALE_MIN = 10;

// Pass 1: forensic analysis of the reference image
const ANALYSIS_PROMPT = `You are a design director. Look at this ad reference image and describe EXACTLY what you see, as structured JSON. Do not invent — only describe what is visible.

Return JSON with this shape:
{
  "layout": "one paragraph describing the overall composition, grid, where each block sits (top/middle/bottom, left/right), and vertical rhythm",
  "background": { "type": "solid|gradient|photo|texture|color-block", "colors": ["hex or plain-english color name..."], "notes": "..." },
  "typography": {
    "headline": { "family": "serif|sans|display-serif|script|mono", "weight": "light|regular|medium|bold|black", "case": "upper|lower|title", "italic": true|false, "size": "small|medium|large|hero", "color": "..." },
    "sub":      { "family": "...", "weight": "...", "case": "...", "italic": true|false, "size": "..." },
    "eyebrow":  { "family": "...", "weight": "...", "case": "...", "notes": "e.g. tracked-out label above headline" }
  },
  "hierarchy": ["ordered list of text blocks from most to least prominent, with a short label for each"],
  "signatureDevices": ["ghosted oversized word", "circular badge with rotating text", "hand-drawn arrow", "border/frame", "torn paper edge", "color-block panel behind photo", "brush stroke highlight", "diagonal divider", "polaroid", "sticker", "handwritten signature", "..."],
  "photoTreatment": { "present": true|false, "shape": "rectangle|circle|blob|cutout|torn|polaroid", "position": "top|middle|bottom-left|right|center|behind-text|beside-text", "size": "small|medium|large|full-bleed", "subject": "person portrait|product|laptop mockup|hands|object|scene" },
  "stockNeeded": ["from the provided STOCK library, list the labels that would BEST substitute the photo/prop shown — leave empty if none apply"],
  "colorRoles": { "bg": "hex-ish", "ink": "hex-ish", "accent": "hex-ish", "pop": "hex-ish", "highlight": "hex-ish" },
  "vibe": "3-6 word aesthetic descriptor (e.g. 'editorial magazine, cream + ink, high contrast')"
}`;

// Pass 2: build the HTML from the analysis + the reference (given both)
const BUILD_CONTRACT = `You generate ONE self-contained HTML ad template for a render engine. You will be given (a) the reference image and (b) a forensic ANALYSIS of that image. Reproduce the LAYOUT, TYPE HIERARCHY, SIGNATURE DEVICES, PHOTO PLACEMENT, and VIBE described in the analysis as faithfully as possible. Do NOT copy the reference's exact text.

FIDELITY RULES:
- Match the composition described in analysis.layout — get the block positions right (top/middle/bottom, left/right, alignment).
- Recreate every item in analysis.signatureDevices. If it says "ghosted oversized word", add one behind the copy at ~10-18% opacity, huge. If "circular badge", add a rotating-text or stamp badge. If "border/frame", add an inset frame. If "torn paper", use clip-path or SVG. If "color-block panel", add a solid block behind the photo/text.
- Match analysis.typography exactly for family (serif vs sans vs display), weight, case, italic, and relative size. Use Google Fonts via @import when needed (Fraunces / Playfair / DM Serif for editorial serif, Poppins / Inter for sans, Caveat / Homemade Apple for script).
- Match analysis.photoTreatment — shape (circle/blob/polaroid/cutout), position, and size. If shape is "cutout" or "blob", use border-radius or SVG clip-path so it looks intentional, not a raw rectangle.
- Match the background type and dominant colors via CSS variables (never hardcode).

STOCK ASSETS: If a stock asset from the provided library fits the photoTreatment.subject better than a generic photo (e.g. laptop mockup, person cutout), use its URL as the src of the <img data-photo>. Otherwise leave data-photo with an empty placeholder src="" — the render engine will fill it.

HARD CONTRACT:
1. One full HTML document, all CSS in one <style>, NO <script>, no external JS.
2. COLORS: never hardcode brand colors. Use CSS variables only: var(--bg), var(--ink), var(--accent), var(--pop), var(--highlight), var(--cream), var(--cta).
3. SIZES: stage is 100vw x 100vh. Provide CSS for BOTH body.feed (1080x1080) and body.story (1080x1920). Default <body class="feed">.
4. TEXT SLOTS: each editable text element has an id; wrap the main text block in class="copy". Use ids from: eyebrow, headlinePre, headlineHL, headlinePost, accent, sub, cta, badgeTop, badgeBottom, sig, headline. Fill with realistic placeholder copy that matches the vibe.
5. PHOTO: if analysis.photoTreatment.present is true, include <img ... data-photo> with the correct shape/position/size and object-fit:cover.
6. STORY SAFE ZONES: in body.story keep ALL text within the middle band — nothing in top 14% or bottom 20%.
7. Robust: no fixed heights that clip text; let .copy flow.

Return ONLY JSON: {"name":"short-kebab-name","type":"single","needsPhoto":true|false,"copySlots":["..."],"styleHint":"one-line vibe","html":"<full html string>"}`;

async function callAI(body: any, timeoutMs = 90_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${LOVABLE_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await resp.json().catch(() => ({} as any));
    return { resp, json };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJSON(content: string) {
  const cleaned = String(content || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned);
}

async function loadStockAssets(admin: any): Promise<Array<{ label: string; url: string; type?: string; notes?: string }>> {
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "template_stock_assets")
    .maybeSingle();
  const list = (data?.value?.assets || data?.value || []) as any[];
  return Array.isArray(list) ? list.filter((a) => a?.label && a?.url) : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    await admin
      .from("template_requests")
      .update({ status: "pending", locked_at: null })
      .eq("status", "building")
      .lt("locked_at", new Date(Date.now() - LOCK_STALE_MIN * 60_000).toISOString());

    const { data: pending, error: pErr } = await admin
      .from("template_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);
    if (pErr) throw pErr;

    const claimed: any[] = [];
    for (const row of pending || []) {
      const { data: upd } = await admin
        .from("template_requests")
        .update({ status: "building", locked_at: new Date().toISOString(), attempts: (row.attempts || 0) + 1 })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      if (upd) claimed.push(upd);
    }

    const stock = await loadStockAssets(admin);
    const stockLibraryText = stock.length
      ? "STOCK LIBRARY (labels the engine may reference in stockNeeded, and URLs the builder may use as <img data-photo src>):\n" +
        stock.map((a) => `- ${a.label}${a.type ? ` [${a.type}]` : ""}: ${a.url}${a.notes ? ` — ${a.notes}` : ""}`).join("\n")
      : "STOCK LIBRARY: (empty — no stock props available)";

    const results: any[] = [];
    for (const row of claimed) {
      try {
        const started = Date.now();

        // ---------- PASS 1: forensic analysis ----------
        const { resp: aResp, json: aJson } = await callAI({
          model: "google/gemini-2.5-pro",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: ANALYSIS_PROMPT + "\n\n" + stockLibraryText },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyze this reference. Notes from admin: " + (row.notes || "(none)") },
                { type: "image_url", image_url: { url: row.reference_url } },
              ],
            },
          ],
        });

        if (!aResp.ok || aJson?.error) {
          const errMsg = aJson?.error?.message || `analysis gateway ${aResp.status}`;
          const giveUp = (row.attempts || 0) >= MAX_ATTEMPTS;
          await admin
            .from("template_requests")
            .update({
              status: giveUp ? "failed" : "pending",
              error: errMsg,
              locked_at: null,
              result: { stage: "analysis", error: errMsg, status: aResp.status },
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, error: errMsg, stage: "analysis" });
          continue;
        }

        let analysis: any = null;
        try {
          analysis = parseJSON(aJson?.choices?.[0]?.message?.content);
        } catch {
          analysis = { raw: aJson?.choices?.[0]?.message?.content };
        }

        // ---------- PASS 2: build HTML ----------
        const { resp: bResp, json: bJson } = await callAI({
          model: "google/gemini-2.5-pro",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: BUILD_CONTRACT + "\n\n" + stockLibraryText },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Build the template. Admin notes: " +
                    (row.notes || "(none)") +
                    "\n\nANALYSIS OF THE REFERENCE:\n" +
                    JSON.stringify(analysis, null, 2),
                },
                { type: "image_url", image_url: { url: row.reference_url } },
              ],
            },
          ],
        });

        if (!bResp.ok || bJson?.error) {
          const errMsg = bJson?.error?.message || `build gateway ${bResp.status}`;
          const giveUp = (row.attempts || 0) >= MAX_ATTEMPTS;
          await admin
            .from("template_requests")
            .update({
              status: giveUp ? "failed" : "pending",
              error: errMsg,
              locked_at: null,
              result: { stage: "build", error: errMsg, status: bResp.status, analysis },
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, error: errMsg, stage: "build" });
          continue;
        }

        const content = bJson?.choices?.[0]?.message?.content;
        let body: any = null;
        try {
          body = parseJSON(content);
        } catch {
          const giveUp = (row.attempts || 0) >= MAX_ATTEMPTS;
          await admin
            .from("template_requests")
            .update({
              status: giveUp ? "failed" : "pending",
              error: "model returned invalid JSON",
              locked_at: null,
              result: { stage: "build", raw: String(content || "").slice(0, 2000), analysis },
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, error: "invalid_json" });
          continue;
        }

        body.ok = typeof body?.html === "string" && body.html.length > 0;
        body.ms = Date.now() - started;
        body.analysis = analysis;

        let templateId: string | null = null;
        if (body?.ok) {
          const { data: ins } = await admin
            .from("templates")
            .insert({
              name: body.name || "Untitled template",
              type: body.type === "carousel" ? "carousel" : "single",
              html: body.html,
              copy_slots: body.copySlots || [],
              slide_slots: body.slideSlots || [],
              needs_photo: body.needsPhoto ?? true,
              style_hint: body.styleHint || analysis?.vibe || null,
              source_image_url: row.source_path || row.reference_url,
              status: "draft",
            })
            .select("id")
            .maybeSingle();
          templateId = ins?.id || null;
        }

        await admin
          .from("template_requests")
          .update({
            status: body?.ok ? "ready" : "failed",
            error: body?.ok ? null : (body?.errors || []).join("; ") || "validation_failed",
            result: { ...body, template_id: templateId },
            locked_at: null,
          })
          .eq("id", row.id);

        results.push({ id: row.id, ok: !!body?.ok, template_id: templateId });
      } catch (e: any) {
        const giveUp = (row.attempts || 0) >= MAX_ATTEMPTS;
        await admin
          .from("template_requests")
          .update({
            status: giveUp ? "failed" : "pending",
            error: e?.message || String(e),
            locked_at: null,
          })
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  }
});
