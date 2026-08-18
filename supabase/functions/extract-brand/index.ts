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

// A color that will actually READ as branding in a rendered ad: has real
// saturation and isn't a near-white tint or near-black shade. Pale tints
// like #f9e6c6 pass the grayscale check but render as "no branding at all"
// (seen live: adsbylumi.com extracted as cream/tan/mint/black only).
const isVividHex = (hex: string): boolean => {
  if (isNearGrayscale(hex)) return false;
  const l = hexLuminance(hex);
  return l > 0.03 && l < 0.75;
};

// Funnel / page-builder hosts. Pages on these serve the BUILDER's default
// template palette (e.g. Kartra's #2e88dc button blue), not the customer's
// brand. When we see one, we also scrape the brand's own domain, derived from
// the subdomain label (thepianopath.kartra.com -> thepianopath.com), and let
// that palette win.
const FUNNEL_HOSTS = [
  "kartra.com",
  "mykajabi.com",
  "clickfunnels.com",
  "leadpages.co",
  "lpages.co",
  "systeme.io",
  "gohighlevel.com",
  "funnels.co",
  "podia.com",
  "teachable.com",
  "thinkific.com",
  "convertkit.com",
  "ck.page",
  "hubspotpagebuilder.com",
  "webflow.io",
  "squarespace.com",
  "wixsite.com",
  "myshopify.com",
  "notion.site",
  "carrd.co",
];

// Default palettes shipped by those builders — never treat as brand colors.
const BUILDER_DEFAULT_COLORS = new Set([
  "#2e88dc", // Kartra primary blue
  "#212839", // Kartra dark
  "#4a90e2",
  "#1a73e8",
  "#007bff", // Bootstrap
  "#3b82f6", // Tailwind blue-500
  "#0d6efd",
]);

function brandDomainFromFunnelUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const match = FUNNEL_HOSTS.find((h) => host === h || host.endsWith(`.${h}`));
    if (!match) return null;
    const label = host.slice(0, host.length - match.length - 1).split(".").pop();
    if (!label || label.length < 3 || label === "www" || label === "app") return null;
    return `https://${label}.com`;
  } catch {
    return null;
  }
}

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";


// Signals that a scrape hit a bot-protection wall (Cloudflare, Akamai, PerimeterX,
// Wix/Squarespace challenge pages, etc.) so we can bail fast instead of retrying.
function looksBlocked(status: number, body: string): boolean {
  if (status === 401 || status === 403 || status === 429 || status === 503) return true;
  const s = (body || "").toLowerCase();
  return (
    s.includes("just a moment") ||
    s.includes("attention required") ||
    s.includes("checking your browser") ||
    s.includes("cf-challenge") ||
    s.includes("cf-browser-verification") ||
    s.includes("access denied") ||
    s.includes("captcha") ||
    s.includes("are you a human") ||
    s.includes("bot detection")
  );
}

async function firecrawlBranding(
  url: string,
): Promise<{ suggested: Suggested; raw: Raw } | { blocked: true } | null> {
  if (!FIRECRAWL_API_KEY) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["branding"],
        onlyMainContent: true,
        // Stealth proxy + realistic browser fingerprint so Cloudflare / Wix /
        // Squarespace / Showit sites are less likely to serve a challenge page.
        proxy: "stealth",
        blockAds: true,
        location: { country: "US", languages: ["en-US"] },
        headers: {
          "User-Agent": DESKTOP_UA,
          "Accept-Language": "en-US,en;q=0.9",
        },
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      console.warn("firecrawl branding failed", resp.status, errBody.slice(0, 200));
      if (looksBlocked(resp.status, errBody)) return { blocked: true };
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
    console.warn("firecrawl branding error/timeout", (e as any)?.message || e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function engineFallback(url: string): Promise<Response> {
  if (!ENGINE_URL) {
    return json(502, { error: "No brand extraction provider available" });
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await fetch(`${ENGINE_URL}/extract-brand`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": ENGINE_KEY },
      body: JSON.stringify({ url }),
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    console.warn("engineFallback error/timeout", (e as any)?.message || e);
    return json(200, { error: "engine_timeout" });
  } finally {
    clearTimeout(t);
  }
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

// Homepage <title> / og:title tags are very often a generic word like "Home"
// or "Welcome" rather than the actual brand name. Taking those verbatim gave
// people a brand literally named "Home". Reject the whole-string generic names
// so the caller falls back to the domain-derived name instead. Exact-match only
// (normalized) — never a substring, so real names like "Home Depot" survive.
const GENERIC_SITE_NAMES = new Set([
  "home", "homepage", "home page", "welcome", "welcome!", "index",
  "untitled", "untitled document", "new page", "website", "my website",
  "my site", "main", "start", "landing page", "loading", "dashboard",
]);
function isGenericName(s: string): boolean {
  const normalized = s.trim().toLowerCase().replace(/[.!|·•–—\-\s]+$/, "").trim();
  return GENERIC_SITE_NAMES.has(normalized);
}
function cleanBrandName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length >= 80) return undefined;
  if (isGenericName(trimmed)) return undefined;
  return trimmed;
}

function parseMetaFromHtml(html: string): { name?: string; description?: string } {
  const ogSite = pickMeta(html, ["og:site_name", "application-name", "twitter:site"]);
  const ogTitle = pickMeta(html, ["og:title", "twitter:title"]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, " ")) : null;
  const splitTitle = (t?: string | null) => {
    if (!t) return null;
    let parts = t.split(/\s+[|—–\-·•:]\s+/).map((p) => p.trim()).filter(Boolean);
    // Drop generic segments ("Home", "Welcome") so a title like
    // "Home | After Organic" yields the real brand, not the filler word.
    const real = parts.filter((p) => !isGenericName(p));
    if (real.length) parts = real;
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
    name: cleanBrandName(name),
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
        name: cleanBrandName(name),
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

    // Funnel/page-builder URL → also scrape the brand's own domain, whose
    // palette we prefer over the builder's template colors.
    const brandDomain = brandDomainFromFunnelUrl(url);
    const [fcPage, meta, fcBrandDomain] = await Promise.all([
      firecrawlBranding(url),
      fetchSiteMeta(url),
      brandDomain
        ? firecrawlBranding(brandDomain).catch(() => null)
        : Promise.resolve(null),
    ]);

    const paletteIsBuilderDefault = (r: typeof fcPage) => {
      if (!r || !("suggested" in r)) return false;
      const c = r.suggested.colors;
      const list = [c?.accent, ...(c?.pops ?? [])].filter(Boolean) as string[];
      return list.length > 0 && list.every((h) => BUILDER_DEFAULT_COLORS.has(h.toLowerCase()));
    };

    let fc = fcPage;
    if (
      fcBrandDomain && "suggested" in fcBrandDomain &&
      (paletteIsBuilderDefault(fcPage) || !fcPage || !("suggested" in fcPage))
    ) {
      console.log("[extract-brand] using brand-domain palette from", brandDomain);
      fc = fcBrandDomain;
    } else if (fcBrandDomain && "suggested" in fcBrandDomain && fcPage && "suggested" in fcPage) {
      // Keep the funnel page's palette but strip builder defaults, backfilling
      // from the brand domain so the ad still reads as theirs.
      const pagePops = (fcPage.suggested.colors?.pops ?? []).filter(
        (h) => !BUILDER_DEFAULT_COLORS.has(h.toLowerCase()),
      );
      const pageAccent = fcPage.suggested.colors?.accent;
      const accentIsDefault = !!pageAccent && BUILDER_DEFAULT_COLORS.has(pageAccent.toLowerCase());
      if (accentIsDefault || pagePops.length !== (fcPage.suggested.colors?.pops ?? []).length) {
        const bd = fcBrandDomain.suggested.colors;
        fc = {
          ...fcPage,
          suggested: {
            ...fcPage.suggested,
            colors: {
              ...fcPage.suggested.colors,
              accent: accentIsDefault ? (bd?.accent ?? pagePops[0]) : pageAccent,
              pops: Array.from(new Set([...pagePops, ...(bd?.pops ?? [])])).slice(0, 4),
            },
          },
        };
      }
    }


    // Firecrawl detected a bot-protection wall → return a clear signal FAST so the
    // frontend can trigger its fallback flow (OG meta, Instagram, quick questions)
    // instead of waiting on the engine fallback which will likely also be blocked.
    if (fc && "blocked" in fc && fc.blocked) {
      return json(200, {
        blocked: true,
        reason: "bot_protection",
        name: meta.name,
        description: meta.description,
      });
    }

    // Require a genuinely useful color set (a background AND at least one accent/pop)
    // before accepting Firecrawl's branding result over the engine fallback below —
    // a "200 OK but nearly empty" branding response (e.g. a mostly-blank page that
    // slipped past bot detection) shouldn't short-circuit past a much richer
    // engine-rendered result.
    const fcColors = fc && "suggested" in fc ? fc.suggested.colors : undefined;
    const fcHasUsefulColors =
      !!fcColors?.background && (!!fcColors?.accent || (fcColors?.pops?.length ?? 0) > 0);
    // "Useful" isn't enough on its own: Firecrawl's semantic palette can come back
    // all neutrals (background/ink/pale tints) for vivid-gradient brands, which
    // renders as an unbranded ad. Only short-circuit here when at least one
    // accent/pop would actually read as a brand color; otherwise fall through to
    // the engine's real pixel-based palette picking, keeping Firecrawl's result
    // as fill-in.
    const fcVivid = [fcColors?.accent, ...(fcColors?.pops ?? [])].some(
      (c): c is string => !!c && isVividHex(c),
    );
    const fcFlatColors = fcColors
      ? Array.from(new Set(
          [fcColors.accent, ...(fcColors.pops ?? []), fcColors.background, fcColors.ink]
            .filter((c): c is string => !!c),
        ))
      : [];
    const fcFlatFonts = fc && "suggested" in fc
      ? Array.from(new Set(
          [fc.suggested.fonts?.display?.family, fc.suggested.fonts?.body?.family]
            .filter((f): f is string => !!f),
        ))
      : [];
    if (fc && "suggested" in fc && fcHasUsefulColors && fcVivid) {
      console.log("[extract-brand] palette source: firecrawl", JSON.stringify(fcFlatColors));
      return json(200, {
        name: meta.name,
        description: meta.description,
        colors: fcFlatColors,
        fonts: fcFlatFonts,
        logoUrl: fc.suggested.imagery?.ogImage,
        suggested: fc.suggested,
        raw: fc.raw,
      });
    }
    if (fc && "suggested" in fc && fcHasUsefulColors && !fcVivid) {
      console.log(
        "[extract-brand] firecrawl palette is neutrals-only, trying engine",
        JSON.stringify(fcFlatColors),
      );
    }

    // Engine fallback — normalize to the same flat shape the client expects
    // (name, description, colors, fonts, logoUrl) so colors + tagline render in the reveal.
    const engineRes = await engineFallback(url);
    try {
      const text = await engineRes.text();
      const parsed = text ? JSON.parse(text) : {};
      const raw = parsed?.raw ?? {};
      const suggested = parsed?.suggested ?? {};

      // Colors: prefer curated suggested.colors. IMPORTANT — the engine's extractBrand()
      // (render.js pickBrandColors) returns { bg, ink, accent, pop, highlight, cream,
      // candidates }, NOT { background, pops[] } (that's the Firecrawl-branding shape).
      // Reading both shapes here so the engine's real colors aren't silently dropped.
      const sc = suggested?.colors ?? {};
      const colorList = [
        sc.accent,
        sc.pop,
        sc.highlight,
        ...(Array.isArray(sc.pops) ? sc.pops : []),
        sc.background ?? sc.bg,
        sc.cream,
        sc.ink,
      ].filter((c: unknown): c is string => typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c));
      const fallbackColors = Array.isArray(raw?.backgrounds)
        ? raw.backgrounds.filter((c: unknown): c is string => typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c))
        : [];
      // Engine colors lead; Firecrawl's palette (possibly neutrals-only, which
      // is how we got here) fills in behind them rather than being discarded.
      const engineColors = colorList.length ? colorList : fallbackColors;
      const colors = Array.from(new Set([...engineColors, ...fcFlatColors])).slice(0, 8);
      console.log(
        "[extract-brand] palette source:",
        engineColors.length ? "engine" : "firecrawl-fill",
        JSON.stringify(colors),
      );

      // Fonts
      const sf = suggested?.fonts ?? {};
      const fontList = [sf?.display?.family, sf?.body?.family].filter(
        (f: unknown): f is string => typeof f === "string" && f.length > 0,
      );
      const fallbackFonts = Array.isArray(raw?.fonts) ? raw.fonts.filter((f: unknown) => typeof f === "string") : [];
      const fonts = Array.from(
        new Set([...(fontList.length ? fontList : fallbackFonts), ...fcFlatFonts]),
      ).slice(0, 6) as string[];

      const logoUrl = suggested?.imagery?.ogImage || raw?.ogImage || undefined;

      const merged = {
        ...parsed,
        name: cleanBrandName(parsed?.name) || meta.name,
        description: parsed?.description || meta.description || raw?.description,
        colors,
        fonts,
        logoUrl,
      };
      return new Response(JSON.stringify(merged), {
        status: engineRes.status,
        headers: { ...cors, "content-type": "application/json" },
      });
    } catch {
      // Engine response unusable. If Firecrawl at least produced a weak
      // palette, a neutrals-only result still beats an error.
      if (fc && "suggested" in fc && fcHasUsefulColors) {
        console.log("[extract-brand] engine failed, falling back to weak firecrawl palette");
        return json(200, {
          name: meta.name,
          description: meta.description,
          colors: fcFlatColors,
          fonts: fcFlatFonts,
          logoUrl: fc.suggested.imagery?.ogImage,
          suggested: fc.suggested,
          raw: fc.raw,
        });
      }
      return engineRes;
    }
  } catch (e) {
    return json(200, { error: String(e) });
  }
});
