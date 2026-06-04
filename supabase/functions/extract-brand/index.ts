import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ENGINE_URL = Deno.env.get("ENGINE_URL") ?? "";
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

type Suggested = {
  colors?: {
    background?: string;
    ink?: string;
    accent?: string;
    pops?: string[];
  };
  fonts?: {
    display?: { family?: string; url?: string };
    body?: { family?: string };
  };
  voice?: { headlines?: string[]; description?: string };
  imagery?: { ogImage?: string; photos?: string[] };
};

type Raw = {
  backgrounds?: string[];
  textColors?: string[];
  fonts?: string[];
  faces?: { family?: string; url?: string }[];
};

const normalizeHex = (c?: string | null): string | null => {
  if (!c) return null;
  let v = String(c).trim().toLowerCase();
  // rgb()/rgba() -> hex
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const [_, r, g, b] = rgb;
    const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  if (v.startsWith("#")) {
    if (v.length === 4) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(0, 7);
  }
  return null;
};

const hexLuminance = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const isNearGrayscale = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 20;
};

async function firecrawlBranding(url: string): Promise<{ suggested: Suggested; raw: Raw } | null> {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["branding"],
        onlyMainContent: true,
      }),
    });
    if (!resp.ok) {
      console.warn("firecrawl branding failed", resp.status, await resp.text().catch(() => ""));
      return null;
    }
    const data = await resp.json();
    const branding = data?.branding ?? data?.data?.branding;
    if (!branding) return null;

    const bg = normalizeHex(branding?.colors?.background);
    const ink = normalizeHex(branding?.colors?.textPrimary) ??
      normalizeHex(branding?.colors?.textSecondary);
    const primary = normalizeHex(branding?.colors?.primary);
    const secondary = normalizeHex(branding?.colors?.secondary);
    const accent = normalizeHex(branding?.colors?.accent) ?? primary;

    // Pops = vibrant non-grayscale, deduped, ordered by visual weight
    const popCandidates = [primary, secondary, accent, normalizeHex(branding?.colors?.accent)]
      .filter((c): c is string => !!c && !isNearGrayscale(c));
    const pops = Array.from(new Set(popCandidates)).slice(0, 4);

    const displayFamily =
      branding?.typography?.fontFamilies?.heading ??
      branding?.fonts?.[0]?.family ??
      branding?.typography?.fontFamilies?.primary;
    const bodyFamily =
      branding?.typography?.fontFamilies?.primary ??
      branding?.fonts?.[1]?.family ??
      branding?.fonts?.[0]?.family;

    const suggested: Suggested = {
      colors: {
        background: bg ?? "#ffffff",
        ink: ink ?? (bg && hexLuminance(bg) > 0.5 ? "#111111" : "#ffffff"),
        accent: accent ?? primary ?? undefined,
        pops,
      },
      fonts: {
        display: { family: displayFamily },
        body: { family: bodyFamily },
      },
      imagery: {
        ogImage: branding?.images?.ogImage,
      },
    };

    const raw: Raw = {
      backgrounds: bg ? [bg] : [],
      textColors: ink ? [ink] : [],
      fonts: [displayFamily, bodyFamily].filter(Boolean) as string[],
      faces: [],
    };

    return { suggested, raw };
  } catch (e) {
    console.warn("firecrawl branding error", e);
    return null;
  }
}

async function engineFallback(url: string): Promise<Response> {
  if (!ENGINE_URL) {
    return json(502, { error: "No brand extraction provider available" });
  }
  const r = await fetch(`${ENGINE_URL}/extract-brand`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ENGINE_KEY },
    body: JSON.stringify({ url }),
  });
  return new Response(await r.text(), {
    status: r.status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return json(400, { error: "url is required" });
    }

    // 1) Try Firecrawl branding (more accurate than HTML/CSS heuristics)
    const fc = await firecrawlBranding(url);
    if (fc && (fc.suggested.colors?.background || (fc.suggested.colors?.pops?.length ?? 0) > 0)) {
      return json(200, fc);
    }

    // 2) Fallback to internal engine
    return await engineFallback(url);
  } catch (e) {
    return json(200, { error: String(e) });
  }
});
