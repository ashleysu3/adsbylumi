import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const OPENAI = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey","Access-Control-Allow-Methods":"POST, OPTIONS" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { prompt } = await req.json();
    const full = `${prompt}\n\nHARD RULES: no text, words, letters, or logos anywhere in the image. Keep the lower third darker and less busy so text can be overlaid. Square composition, ad-ready.`;
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { authorization: `Bearer ${OPENAI}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt: full, size: "1024x1024", n: 1 }),
    });
    const d = await r.json();
    const b64 = d?.data?.[0]?.b64_json;
    if (!b64) return new Response(JSON.stringify({ error: d?.error?.message || "no image" }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const supa = createClient(SUPABASE_URL, SERVICE);
    const filename = `concept-${crypto.randomUUID()}.png`;
    await supa.storage.from("ad-photos").upload(filename, bytes, { contentType: "image/png", upsert: false });
    const { data: signed } = await supa.storage.from("ad-photos").createSignedUrl(filename, 60 * 60 * 24 * 30);
    return new Response(JSON.stringify({ url: signed?.signedUrl }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
