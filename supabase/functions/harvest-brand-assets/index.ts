import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENGINE_URL = Deno.env.get("ENGINE_URL")!;
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "not authenticated" }), {
        status: 401,
        headers: { ...cors, "content-type": "application/json" },
      });
    }
    const { url } = await req.json();
    const er = await fetch(`${ENGINE_URL}/extract-assets`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ENGINE_KEY },
      body: JSON.stringify({ url }),
    });
    const data = await er.json();
    const assets = (data?.assets || []).slice(0, 40);
    const admin = createClient(SUPABASE_URL, SERVICE);
    let saved = 0;
    for (const a of assets) {
      try {
        const resp = await fetch(a.url);
        if (!resp.ok) continue;
        const ct = resp.headers.get("content-type") || "image/jpeg";
        if (!ct.startsWith("image/")) continue;
        const buf = new Uint8Array(await resp.arrayBuffer());
        if (buf.length > 8_000_000 || buf.length < 1000) continue;
        const ext = ct.includes("png") ? "png" : ct.includes("svg") ? "svg" : ct.includes("webp") ? "webp" : "jpg";
        const filename = `${user.id}/${crypto.randomUUID()}.${ext}`;
        await admin.storage.from("brand-assets").upload(filename, buf, { contentType: ct, upsert: false });
        const { data: pub } = admin.storage.from("brand-assets").getPublicUrl(filename);
        await admin.from("brand_assets").insert({
          user_id: user.id,
          url: pub.publicUrl,
          source_url: a.url,
          role: a.roleGuess,
          width: a.width,
          height: a.height,
        });
        saved++;
      } catch (_) {
        /* skip bad asset */
      }
    }
    return new Response(JSON.stringify({ saved, found: assets.length }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
