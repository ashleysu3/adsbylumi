// Pulls the brand logo from a website using Firecrawl's branding extractor.
// Returns { logoUrl: string | null }.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

function normalizeUrl(input: string): string {
  const cleaned = input.replace(/\s+/g, "");
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned.replace(/^\/+/, "")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!FIRECRAWL) return json({ error: "FIRECRAWL_API_KEY not configured", logoUrl: null });
    const { url } = await req.json();
    if (typeof url !== "string" || !url.trim()) return json({ error: "url required", logoUrl: null });

    const target = normalizeUrl(url.trim());

    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { authorization: `Bearer ${FIRECRAWL}`, "content-type": "application/json" },
      body: JSON.stringify({ url: target, formats: ["branding"], onlyMainContent: false }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("extract-brand-logo firecrawl error", r.status, JSON.stringify(d).slice(0, 400));
      return json({ error: d?.error || `Firecrawl HTTP ${r.status}`, logoUrl: null });
    }

    const b = d?.data?.branding ?? d?.branding ?? {};
    const logoUrl: string | null =
      b?.images?.logo || b?.logo || b?.images?.ogImage || d?.data?.metadata?.ogImage || null;

    return json({ logoUrl: typeof logoUrl === "string" ? logoUrl : null });
  } catch (e) {
    console.error("extract-brand-logo exception", e);
    return json({ error: e instanceof Error ? e.message : String(e), logoUrl: null });
  }
});
