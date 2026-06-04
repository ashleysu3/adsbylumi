import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const OPENAI = Deno.env.get("OPENAI_API_KEY")!;
const LOVABLE = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey","Access-Control-Allow-Methods":"POST, OPTIONS" };

const OPTIMIZER = `You turn a rough ad concept into ONE vivid image-generation prompt for an AI image model. RULES:
- Describe ONE strong, specific visual scene or subject — concrete and singular, never a collage of icons.
- Pick a clear style that fits: photographic, cinematic, editorial 3D render, or bold minimal illustration.
- Specify lighting, mood, and a tight color palette.
- ABSOLUTELY NO text, words, letters, numbers, logos, app screenshots, or UI/interface chrome in the image. If the concept involves text, a notification, a headline, or a screen, translate it into a physical VISUAL METAPHOR instead (e.g. an ad rejection -> a red "rejected" rubber stamp pressed onto paperwork; policy chaos -> a tangled knot of red tape).
- Composition: keep the lower third darker and emptier so text can be overlaid later; use negative space.
Output ONLY the final image prompt as one paragraph — no preamble, no quotes.`;

async function optimize(concept: string): Promise<string> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${LOVABLE}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [ { role: "system", content: OPTIMIZER }, { role: "user", content: concept } ] }),
    });
    const d = await r.json();
    return d?.choices?.[0]?.message?.content?.trim() || concept;
  } catch { return concept; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { prompt } = await req.json();
    const optimized = await optimize(prompt);
    const full = `${optimized}\n\nHARD RULES: absolutely no text, words, letters, or logos anywhere. Keep the lower third darker and less busy for text overlay. Square, ad-ready.`;
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { authorization: `Bearer ${OPENAI}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "dall-e-3", prompt: full, size: "1024x1024", n: 1, response_format: "b64_json", quality: "hd" }),
    });
    const d = await r.json();
    const b64 = d?.data?.[0]?.b64_json;
    if (!b64) return new Response(JSON.stringify({ error: d?.error?.message || "no image" }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const supa = createClient(SUPABASE_URL, SERVICE);
    const filename = `concept-${crypto.randomUUID()}.png`;
    await supa.storage.from("ad-photos").upload(filename, bytes, { contentType: "image/png", upsert: false });
    const { data: signed } = await supa.storage.from("ad-photos").createSignedUrl(filename, 60 * 60 * 24 * 30);
    return new Response(JSON.stringify({ url: signed?.signedUrl, optimizedPrompt: optimized }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
