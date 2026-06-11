import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requirePaidUser } from "../_shared/check-subscription.ts";
const KEY = Deno.env.get("LOVABLE_API_KEY")!;
const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS" };

const CONTRACT = `You generate ONE self-contained HTML ad template for a render engine. Reproduce the LAYOUT and STYLE of the reference image — its composition, type hierarchy, shapes, photo placement, and any signature devices — but do NOT copy its exact text or photo. Follow this contract EXACTLY:

CAPTURE THE REFERENCE'S DISTINCTIVE DEVICES if present:
- An oversized faded/ghosted word in the background (recreate it as a large low-opacity element).
- A portrait/photo region — match WHERE it sits (left, right, top, full-bleed) and its size.
- A frame or border, color-block panels, a divider line, or a circular badge/sticker.
- A signature or small brand label.
- The dominant background color of the reference -> map it to var(--bg) or var(--cream).
- Serif vs sans choices and any italic kicker lines.

HARD CONTRACT:
1. One full HTML document, all CSS in one <style>, NO <script>, no external JS.
2. COLORS: never hardcode brand colors. Use CSS variables only: var(--bg), var(--ink), var(--accent), var(--pop), var(--highlight), var(--cream), var(--cta). Map the reference's main colors onto these roles.
3. SIZES: stage is 100vw x 100vh. Provide CSS for BOTH body.feed (1080x1080) and body.story (1080x1920). Default <body class="feed">.
4. TEXT SLOTS: each editable text element has an id; wrap the main text block in class="copy" (engine auto-fits it). Use a small sensible set of ids from: eyebrow, headlinePre, headlineHL, headlinePost, accent, sub, cta, badgeTop, badgeBottom, sig, headline. Decorative elements (like a faded word) can be a fixed element OR an id if you want it editable.
5. PHOTO: if the design has a photo, add <img ... data-photo> with object-fit:cover, positioned like the reference. If no photo, needsPhoto=false and no data-photo element.
6. STORY SAFE ZONES: in body.story keep ALL text within the middle band — nothing in the top 14% or bottom 20%.
7. FONTS: @import Poppins for sans; for serif use 'DisplayItalic' (brand serif, italic) with a serif fallback, or @import Fraunces.
8. Robust: no fixed heights that clip text; let .copy flow.

Return ONLY JSON: {"name":"short-kebab-name","type":"single","needsPhoto":true,"copySlots":["..."],"html":"<full html string>"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { imageUrl, notes = "" } = await req.json();
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", response_format: { type: "json_object" },
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
