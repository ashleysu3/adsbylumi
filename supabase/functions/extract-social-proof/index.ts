// Extracts social proof (testimonials, press, stats) from a website + IG bio if available.
// POST { brandId, url } → { items: string[] } and writes brand.social_proof
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fetchPage(url: string): Promise<string> {
  // Prefer Firecrawl for rendered content; fall back to plain fetch.
  if (FIRECRAWL_API_KEY) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (r.ok) {
        const j = await r.json();
        const md = j?.data?.markdown || "";
        if (md) return md.slice(0, 20000);
      }
    } catch { /* fall through */ }
  }
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 LumiBot" } });
    if (!r.ok) return "";
    const html = await r.text();
    return html.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ").slice(0, 20000);
  } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "not authenticated" }), {
        status: 200, headers: { ...cors, "content-type": "application/json" },
      });
    }
    const { brandId, url } = await req.json();
    if (!brandId || !url) {
      return new Response(JSON.stringify({ error: "missing brandId or url" }), {
        status: 200, headers: { ...cors, "content-type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: brand } = await admin.from("brands").select("user_id").eq("id", brandId).maybeSingle();
    if (!brand || brand.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "access denied" }), {
        status: 200, headers: { ...cors, "content-type": "application/json" },
      });
    }

    const text = await fetchPage(url);
    if (!text) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200, headers: { ...cors, "content-type": "application/json" },
      });
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extract social proof from a website. Return JSON only: {\"items\":[string,...]}. Include testimonials (with name when present), press mentions, awards, and concrete stats (e.g. '10,000+ students enrolled'). Up to 8 items. If none, return empty array. Each item under 240 chars." },
          { role: "user", content: `Site content:\n\n${text}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    let items: string[] = [];
    if (r.ok) {
      const j = await r.json();
      try {
        const parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
        if (Array.isArray(parsed.items)) items = parsed.items.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 8);
      } catch { /* ignore parse */ }
    }

    if (items.length) {
      await admin.from("brands").update({ social_proof: items }).eq("id", brandId);
    }
    return new Response(JSON.stringify({ items }), {
      status: 200, headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 200, headers: { ...cors, "content-type": "application/json" },
    });
  }
});
