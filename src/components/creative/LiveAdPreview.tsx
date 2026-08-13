import { useEffect, useState } from "react";

/**
 * Approximate live preview of the ad being composed.
 *
 * This is intentionally NOT the render engine — it's a fast, local, CSS-only
 * approximation so the user can see copy + photo + brand colors update while
 * they type, instead of editing blind and waiting on a render round-trip.
 * The real render still comes from the engine and replaces this once ready.
 */

export type PreviewColors = {
  bg: string; ink: string; accent: string; pop: string; highlight: string; cream: string;
};

type Copy = Record<string, string>;

const firstText = (copy: Copy, keys: string[]) => {
  for (const k of keys) {
    const v = copy[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const applyCase = (s: string, mode: "original" | "upper" | "lower" | "title") => {
  if (!s) return s;
  if (mode === "upper") return s.toUpperCase();
  if (mode === "lower") return s.toLowerCase();
  if (mode === "title") return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return s;
};

function linesFor(copy: Copy) {
  const headlineParts = [copy.headlinePre, copy.headlineHL, copy.headlinePost]
    .filter((x) => typeof x === "string" && x.trim())
    .join(" ");
  const headline =
    firstText(copy, ["headline"]) ||
    headlineParts ||
    firstText(copy, ["offerBig", "line1", "body", "msg1", "bubble1", "item1"]);
  const sub = firstText(copy, ["sub", "line2", "accent", "meta", "msg2", "bubble2", "item2", "terms"]);
  const eyebrow = firstText(copy, ["eyebrow", "badgeTop", "tickerTop", "discount", "host"]);
  const cta = firstText(copy, ["cta", "badgeBottom", "tickerBottom", "expiry"]);
  return { headline, sub, eyebrow, cta };
}

export function LiveAdPreview({
  copy,
  slides,
  isCarousel,
  colors,
  displayFamily,
  bodyFamily,
  photoUrl,
  backgroundUrl,
  textCase = "original",
  headlineScale = 1,
  bodyScale = 1,
  logoUrl,
  showLogo,
  logoCorner = "br",
}: {
  copy?: Copy;
  slides?: Copy[];
  isCarousel?: boolean;
  colors: PreviewColors;
  displayFamily?: string;
  bodyFamily?: string;
  photoUrl?: string;
  backgroundUrl?: string;
  textCase?: "original" | "upper" | "lower" | "title";
  headlineScale?: number;
  bodyScale?: number;
  logoUrl?: string;
  showLogo?: boolean;
  logoCorner?: "tl" | "tr" | "bl" | "br";
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const total = slides?.length || 0;

  useEffect(() => {
    if (slideIdx > Math.max(0, total - 1)) setSlideIdx(0);
  }, [total, slideIdx]);

  const active: Copy = isCarousel ? (slides?.[slideIdx] || {}) : (copy || {});
  const { headline, sub, eyebrow, cta } = linesFor(active);
  const hasAnything = headline || sub || eyebrow || cta;

  const bgImage = backgroundUrl || photoUrl;
  const cornerClass = {
    tl: "top-3 left-3", tr: "top-3 right-3", bl: "bottom-3 left-3", br: "bottom-3 right-3",
  }[logoCorner];

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-lg border border-border"
        style={{ backgroundColor: colors.bg }}
      >
        {bgImage && (
          <img
            src={bgImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {bgImage && (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to top, ${colors.bg}f2 12%, ${colors.bg}66 55%, transparent 100%)` }}
          />
        )}

        <div className="relative flex h-full flex-col justify-end gap-2 p-5">
          {eyebrow && (
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: colors.accent, fontFamily: bodyFamily || undefined }}
            >
              {applyCase(eyebrow, textCase)}
            </p>
          )}
          {headline && (
            <p
              className="font-bold leading-[1.06]"
              style={{
                color: colors.ink,
                fontFamily: displayFamily || undefined,
                fontSize: `${1.5 * headlineScale}rem`,
              }}
            >
              {applyCase(headline, textCase)}
            </p>
          )}
          {sub && (
            <p
              className="leading-snug opacity-85"
              style={{
                color: colors.ink,
                fontFamily: bodyFamily || undefined,
                fontSize: `${0.8125 * bodyScale}rem`,
              }}
            >
              {applyCase(sub, textCase)}
            </p>
          )}
          {cta && (
            <span
              className="mt-1 inline-flex w-fit rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ backgroundColor: colors.accent, color: colors.cream, fontFamily: bodyFamily || undefined }}
            >
              {applyCase(cta, textCase)}
            </span>
          )}
          {!hasAnything && (
            <p className="text-xs text-muted-foreground">
              Your copy will appear here as it's written.
            </p>
          )}
        </div>

        {showLogo && logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className={`absolute h-7 w-7 rounded object-contain ${cornerClass}`}
            style={{ backgroundColor: `${colors.cream}cc` }}
          />
        )}
      </div>

      {isCarousel && total > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {slides!.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Preview slide ${i + 1}`}
              onClick={() => setSlideIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === slideIdx ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        {isCarousel && total > 1 ? `Slide ${slideIdx + 1} of ${total} · ` : ""}
        Rough preview — the final render is sharper and follows the template exactly.
      </p>
    </div>
  );
}
