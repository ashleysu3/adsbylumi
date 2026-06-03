import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const KEY = Deno.env.get("OPENAI_API_KEY")!;
const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS" };

const CONTRACT = `You generate ONE self-contained HTML ad template for a render engine. Reproduce the LAYOUT/STYLE of the reference image (composition, type hierarchy, shapes, photo placement) — do NOT copy its exact text or photo. Output must follow this contract EXACTLY:

1. A single full HTML document (<!DOCTYPE html>...). All CSS in one <style>. No <script>. No external JS.
2. COLORS: never hardcode brand colors. Use CSS variables: var(--bg), var(--ink), var(--accent), var(--pop), var(--highlight), var(--cream), var(--cta). The engine sets these per brand.
3. SIZES: the stage is 100vw x 100vh. Provide CSS for BOTH 'body.feed' (1080x1080) and 'body.story' (1080x1920). Default <body class="feed">.
4. TEXT SLOTS: each editable text element has an id. Wrap the main text block in an element with class="copy" (the engine auto-shrinks it to fit). Choose a small, sensible set of slot ids from: eyebrow, headlinePre, headlineHL, headlinePost, accent, sub, cta, badgeTop, badgeBottom, sig, headline. Only include ids your layout actually uses.
5. PHOTO: if the design includes a photo, add it as <img ... data-photo> (the engine sets its src). Use object-fit:cover. If no photo, set needsPhoto false and include no data-photo element.
6. STORY SAFE ZONES: in body.story, keep ALL text within the middle band — nothing in the top 14% or bottom 20% (those are covered by the platform's profile name and CTA).
7. FONTS: @import Poppins for sans. For a serif, use 'DisplayItalic' (the engine loads the brand's serif under that name) with a serif fallback, or import 'Fraunces'.
8. Keep it robust: no fixed heights that clip text; let the .copy block flow.

Return ONLY JSON: {"name":"short-kebab-name","type":"single","needsPhoto":true,"copySlots":["..."],"html":"<full html string>"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { imageUrl, notes = "" } = await req.json();
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", temperature: 0.4, response_format: { type: "json_object" },
        messages: [ { role: "system", content: CONTRACT },
          { role: "user", content: [ { type: "text", text: "Build a template matching this reference. Notes: " + notes }, { type: "image_url", image_url: { url: imageUrl } } ] } ] }),
    });
    const d = await r.json();
    if (!r.ok || d?.error) {
      console.error("openai error", d);
      return new Response(JSON.stringify({ error: d?.error?.message || `OpenAI ${r.status}` }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }
    const content = d?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("no content from openai", d);
      return new Response(JSON.stringify({ error: "Empty response from model" }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }
    return new Response(content, { status: 200, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ error: String(e) }), { status: 200, headers: { ...cors, "content-type": "application/json" } }); }
});
