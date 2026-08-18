// Quality guards for the first ad a new visitor ever sees.
//
// Everything in here is deterministic and client-side: it ranks what the
// extraction/compose steps already returned instead of asking a model again.
// The goal is that the *worst* possible first ad gets filtered out before it
// ever renders — no favicon-as-hero, no white-on-white palette, no headline
// that opens with "Unlock the power of".

import { SEGMENTED_HEADLINE_TEMPLATES } from "@/components/ad-kit/types";

export type ProbedPhoto = {
  url: string;
  label?: string;
  width: number;
  height: number;
  score: number;
};

const MIN_PHOTO_EDGE = 400;
const MIN_PHOTO_PIXELS = 400 * 400;

/** Load an image just far enough to read its natural dimensions. */
function probeSize(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const img = new Image();
    let settled = false;
    const done = (v: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    img.crossOrigin = "anonymous";
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => done(null);
    // Never let a hung asset stall the build.
    setTimeout(() => done(null), 8000);
    img.src = url;
  });
}

function looksLikeChrome(url: string): boolean {
  const u = url.toLowerCase();
  return /(favicon|sprite|icon|logo|badge|placeholder|avatar-default|1x1|pixel)/.test(u);
}

/**
 * Score a photo candidate for "can this carry an ad?".
 * Bigger is better; anything <= 0 should not be used as the hero image.
 */
export function scorePhoto(url: string, width: number, height: number): number {
  if (!width || !height) return 0;
  const pixels = width * height;
  const shortEdge = Math.min(width, height);
  const ratio = width / height;

  if (shortEdge < MIN_PHOTO_EDGE) return 0;
  if (pixels < MIN_PHOTO_PIXELS) return 0;
  // Wildly letterboxed banners crop into mush inside a square/portrait ad.
  if (ratio > 3 || ratio < 0.33) return 0;
  if (looksLikeChrome(url)) return 0;

  let score = Math.min(pixels / (1200 * 1200), 1) * 60; // resolution, capped
  // Portrait and square read best in feed placements.
  if (ratio >= 0.6 && ratio <= 1.4) score += 25;
  else if (ratio < 0.6) score += 15;
  if (shortEdge >= 800) score += 15;
  return score;
}

/**
 * Probe every candidate, drop the ones that can't carry an ad, and return the
 * survivors best-first. Returns an empty array when nothing clears the bar —
 * callers should fall back to a text-forward template rather than render an
 * ad around a bad image.
 */
export async function rankPhotoCandidates(
  candidates: { url: string; label?: string }[],
): Promise<ProbedPhoto[]> {
  const probed = await Promise.all(
    candidates.map(async (c) => {
      const size = await probeSize(c.url);
      if (!size) return null;
      const score = scorePhoto(c.url, size.width, size.height);
      if (score <= 0) return null;
      return { ...c, width: size.width, height: size.height, score } as ProbedPhoto;
    }),
  );
  return (probed.filter(Boolean) as ProbedPhoto[]).sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Copy ranking
// ---------------------------------------------------------------------------

const FILLER_OPENERS = [
  "unlock", "discover", "introducing", "imagine", "are you tired",
  "in today's", "in todays", "elevate your", "transform your", "take your",
  "level up", "the ultimate", "revolutionize", "supercharge",
];

const HEADLINE_SWEET_SPOT: [number, number] = [18, 60];

function headlineOf(template: string, opt: any): string {
  if (!opt || typeof opt !== "object") return "";
  if (SEGMENTED_HEADLINE_TEMPLATES.has(template)) {
    return [opt.headlinePre, opt.headlineHL, opt.headlinePost].filter(Boolean).join(" ").trim();
  }
  if (template === "starquote") {
    return [opt.quotePre, opt.quoteHL, opt.quotePost].filter(Boolean).join(" ").trim();
  }
  return String(opt.headline || opt.quote || "").trim();
}

/**
 * Score one compose-ad option. Rewards: headline in the readable band, a real
 * CTA, the brand or offer actually named. Penalizes: filler openers, ALL CAPS
 * shouting, headline overflow, empty fields.
 */
export function scoreCopyOption(
  template: string,
  opt: any,
  ctx: { brandName?: string; offerText?: string } = {},
): number {
  const headline = headlineOf(template, opt);
  if (!headline) return -100;
  let score = 0;

  const len = headline.length;
  if (len >= HEADLINE_SWEET_SPOT[0] && len <= HEADLINE_SWEET_SPOT[1]) score += 30;
  else if (len < HEADLINE_SWEET_SPOT[0]) score -= 15;
  else score -= Math.min((len - HEADLINE_SWEET_SPOT[1]) / 2, 30);

  const lower = headline.toLowerCase();
  if (FILLER_OPENERS.some((f) => lower.startsWith(f))) score -= 25;
  else if (FILLER_OPENERS.some((f) => lower.includes(f))) score -= 10;

  // Shouting reads as spam in feed.
  const letters = headline.replace(/[^A-Za-z]/g, "");
  if (letters.length > 8 && headline === headline.toUpperCase()) score -= 15;

  const cta = typeof opt.cta === "string" ? opt.cta.trim() : "";
  if (cta) {
    score += 15;
    if (cta.split(/\s+/).length <= 4) score += 5;
  } else {
    score -= 10;
  }

  const all = Object.values(opt)
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  if (ctx.brandName && ctx.brandName.length > 2 && all.includes(ctx.brandName.toLowerCase())) score += 8;
  if (ctx.offerText) {
    const offerWords = ctx.offerText
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4);
    const hits = offerWords.filter((w) => all.includes(w)).length;
    score += Math.min(hits * 4, 12);
  }

  // Empty/placeholder-ish fields drag an option down.
  const emptyish = Object.values(opt).filter(
    (v) => typeof v === "string" && v.trim().length === 0,
  ).length;
  score -= emptyish * 5;

  return score;
}

/** Index of the strongest option — never worse than 0 (the old default). */
export function bestCopyIndex(
  template: string,
  options: any[],
  ctx: { brandName?: string; offerText?: string } = {},
): number {
  if (!options.length) return 0;
  let bestIdx = 0;
  let bestScore = -Infinity;
  options.forEach((opt, i) => {
    const s = scoreCopyOption(template, opt, ctx);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Palette guard
// ---------------------------------------------------------------------------

type Rgb = { r: number; g: number; b: number };

function toRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex?.trim() || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relLuminance(hex: string): number {
  const c = toRgb(hex);
  if (!c) return 0;
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export function saturationOf(hex: string): number {
  const c = toRgb(hex);
  if (!c) return 0;
  const max = Math.max(c.r, c.g, c.b) / 255;
  const min = Math.min(c.r, c.g, c.b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

export type GuardedPalette<T extends Record<string, string>> = T;

/**
 * Make an extracted palette safe to render:
 *  - text vs background must clear a 4.5:1 contrast ratio
 *  - accents must not be near-white / washed out (they carry the CTA chip)
 * Falls back to the brand's own dark ink or a safe neutral rather than
 * inventing a color the brand has never used.
 */
export function guardPalette<T extends { bg: string; ink: string; accent: string; pop: string; highlight: string; cream: string }>(
  p: T,
): T {
  const out: any = { ...p };

  // 1) Ink must be readable on bg. Flip to black/white if the pair is unusable.
  if (contrastRatio(out.ink, out.bg) < 4.5) {
    out.ink = relLuminance(out.bg) > 0.4 ? "#111111" : "#ffffff";
  }

  // 2) An accent that's near-white or desaturated disappears behind the CTA
  //    text. Prefer another usable brand color before falling back.
  const accentUsable = (hex: string) =>
    !!toRgb(hex) &&
    relLuminance(hex) < 0.75 &&
    relLuminance(hex) > 0.02 &&
    saturationOf(hex) > 0.18 &&
    contrastRatio(hex, out.bg) >= 1.8;

  if (!accentUsable(out.accent)) {
    const alt = [out.pop, out.highlight, out.ink].find((c) => accentUsable(c));
    out.accent = alt || out.ink;
  }
  if (!accentUsable(out.pop)) out.pop = out.accent;
  if (!accentUsable(out.highlight)) out.highlight = out.accent;

  // 3) Anything sitting on the accent (CTA label) uses bg — make sure that reads.
  if (contrastRatio(out.accent, out.bg) < 2.5) {
    out.bg = relLuminance(out.accent) > 0.4 ? "#111111" : "#ffffff";
    if (contrastRatio(out.ink, out.bg) < 4.5) {
      out.ink = relLuminance(out.bg) > 0.4 ? "#111111" : "#ffffff";
    }
  }

  // 4) `cream` is the card surface most photo templates lay copy on. It was
  //    never validated, which is how a white headline ended up on a cream card
  //    (unreadable) even though ink-vs-bg passed. Force it to a real light
  //    surface and make sure ink reads on BOTH surfaces, not just bg.
  if (!toRgb(out.cream) || relLuminance(out.cream) < 0.5) {
    out.cream = "#fdf7f2";
  }
  if (contrastRatio(out.ink, out.cream) < 4.5) {
    out.ink = relLuminance(out.cream) > 0.4 ? "#111111" : "#ffffff";
    // Flipping ink for the card must not break it against bg.
    if (contrastRatio(out.ink, out.bg) < 4.5) {
      out.bg = relLuminance(out.ink) > 0.5 ? "#111111" : "#ffffff";
    }
  }
  // An accent chip sitting on the cream card needs to separate from it too.
  if (contrastRatio(out.accent, out.cream) < 2.5) {
    const alt = [out.pop, out.highlight, out.ink].find(
      (c: string) => contrastRatio(c, out.cream) >= 2.5,
    );
    out.accent = alt || (relLuminance(out.cream) > 0.4 ? "#111111" : "#ffffff");
    if (contrastRatio(out.pop, out.cream) < 2.5) out.pop = out.accent;
    if (contrastRatio(out.highlight, out.cream) < 2.5) out.highlight = out.accent;
  }

  return out as T;
}

/**
 * Black or white — whichever is readable on top of `surface`. Used for every
 * label the engine paints onto a colored chip/card so we never hand it a
 * "text color" that happens to match the surface underneath.
 */
export function readableTextOn(surface: string): string {
  return relLuminance(surface) > 0.42 ? "#111111" : "#ffffff";
}


/** Normalize a website/domain string to the key used for pinned demo ads. */
export function normalizeDemoDomain(input?: string | null): string {
  if (!input) return "";
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  return s;
}
