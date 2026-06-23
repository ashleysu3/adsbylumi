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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .trim();
}

function pickMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeEntities(m2[1]);
  }
  return null;
}

function parseMetaFromHtml(html: string): { name?: string; description?: string } {
  const ogSite = pickMeta(html, ["og:site_name", "application-name", "twitter:site"]);
  const ogTitle = pickMeta(html, ["og:title", "twitter:title"]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, " ")) : null;
  const splitTitle = (t?: string | null) => {
    if (!t) return null;
    const parts = t.split(/\s+[|—–\-·•:]\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const last = parts[parts.length - 1];
    const first = parts[0];
    // Prefer the segment that looks most like a brand name (shorter, no verbs)
    return first.length <= last.length ? first : last;
  };
  const name = ogSite || splitTitle(ogTitle) || splitTitle(rawTitle) || undefined;
  const description =
    pickMeta(html, ["og:description", "twitter:description", "description"]) || undefined;
  return {
    name: name && name.length > 0 && name.length < 80 ? name : undefined,
    description: description && description.length < 400 ? description : undefined,
  };
}

async function fetchSiteMeta(url: string): Promise<{ name?: string; description?: string }> {
  // Try direct fetch first (fast)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(t);
    if (res.ok) {
      const html = (await res.text()).slice(0, 200_000);
      const meta = parseMetaFromHtml(html);
      if (meta.name || meta.description) return meta;
    }
  } catch (e) {
    console.warn("fetchSiteMeta direct fetch failed", (e as any)?.message || e);
  }

  // Fallback: Firecrawl scrape (handles bot-protected / SPA / Showit sites)
  if (FIRECRAWL_API_KEY) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false }),
      });
      clearTimeout(t);
      const data = await res.json().catch(() => null);
      const html: string | undefined = data?.data?.html || data?.html;
      const md: any = data?.data?.metadata || data?.metadata;
      const fromHtml = html ? parseMetaFromHtml(html) : {};
      const name =
        fromHtml.name ||
        md?.ogSiteName ||
        md?.["og:site_name"] ||
        md?.title?.split?.(/\s+[|—–\-·•:]\s+/)?.[0]?.trim();
      const description = fromHtml.description || md?.description || md?.ogDescription;
      return {
        name: name && name.length < 80 ? name : undefined,
        description: description && description.length < 400 ? description : undefined,
      };
    } catch (e) {
      console.warn("fetchSiteMeta firecrawl fallback failed", (e as any)?.message || e);
    }
  }

  return {};
}



serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return json(400, { error: "url is required" });
    }

    // Fetch site meta (title, og:site_name, description) in parallel with branding
    const [fc, meta] = await Promise.all([firecrawlBranding(url), fetchSiteMeta(url)]);


    if (fc && (fc.suggested.colors?.background || (fc.suggested.colors?.pops?.length ?? 0) > 0)) {
      // Normalize into the flat shape the client reads (name, description, colors, fonts, logoUrl)
      const colors = [
        fc.suggested.colors?.accent,
        ...(fc.suggested.colors?.pops ?? []),
        fc.suggested.colors?.background,
        fc.suggested.colors?.ink,
      ].filter((c): c is string => !!c);
      const fonts = [fc.suggested.fonts?.display?.family, fc.suggested.fonts?.body?.family].filter(
        (f): f is string => !!f,
      );
      return json(200, {
        name: meta.name,
        description: meta.description,
        colors: Array.from(new Set(colors)),
        fonts: Array.from(new Set(fonts)),
        logoUrl: fc.suggested.imagery?.ogImage,
        suggested: fc.suggested,
        raw: fc.raw,
      });
    }

    // Engine fallback — still merge our scraped name/description so the brand isn't named after the URL.
    const engineRes = await engineFallback(url);
    try {
      const text = await engineRes.text();
      const parsed = text ? JSON.parse(text) : {};
      const merged = {
        ...parsed,
        name: parsed?.name || meta.name,
        description: parsed?.description || meta.description,
      };
      return new Response(JSON.stringify(merged), {
        status: engineRes.status,
        headers: { ...cors, "content-type": "application/json" },
      });
    } catch {
      return engineRes;
    }
  } catch (e) {
    return json(200, { error: String(e) });
  }
});
