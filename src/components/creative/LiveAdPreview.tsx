import { useEffect, useState } from "react";

/**
 * Approximate live preview of the ad being composed.
 *
 * This is intentionally NOT the render engine — it's a fast, local, CSS-only
 * approximation so the user can see copy + photo + brand colors update while
 * they type, instead of editing blind and waiting on a render round-trip.
 *
 * IMPORTANT: the preview follows the SELECTED template's layout family. It used
 * to always draw one generic bottom-aligned layout, which made it look like the
 * dialog was previewing a random template instead of the chosen one.
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
  // Signature ("— Wendy, The Chair Stylist") is a real slot in several
  // templates; it was collected in the editor but never drawn here.
  const sig = firstText(copy, ["sig", "signature", "contactName"]);
  return { headline, sub, eyebrow, cta, sig };
}

// Turn a hex color into rgba() so the text box can be dialed in with opacity.
function hexWithAlpha(hex: string, alpha: number) {
  const h = (hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}


// Pull an ordered list of repeated slots (item1..item6, stat1Num/stat1Label, msg1..)
const listOf = (copy: Copy, prefix: string, max = 6) =>
  Array.from({ length: max }, (_, i) => copy[`${prefix}${i + 1}`])
    .filter((v): v is string => typeof v === "string" && !!v.trim());

const statsOf = (copy: Copy) =>
  Array.from({ length: 4 }, (_, i) => ({
    num: copy[`stat${i + 1}Num`],
    label: copy[`stat${i + 1}Label`],
  })).filter((s) => (s.num && s.num.trim()) || (s.label && s.label.trim()));

type Family =
  | "split" | "framed" | "spotlight" | "overlay" | "device" | "collage"
  | "bigtype" | "offer" | "event" | "checklist" | "statgrid"
  | "testimonial" | "chat" | "notes" | "bubbles";

const FAMILY: Record<string, Family> = {
  split: "split",
  framed: "framed",
  spotlight: "spotlight",
  overlay: "overlay",
  nativecaption: "overlay",
  nativestroke: "overlay",
  cutout: "spotlight",
  highlighter: "overlay",
  devicemockup: "device",
  collage: "collage",
  bigtype: "bigtype",
  offer: "offer",
  event: "event",
  checklist: "checklist",
  statgrid: "statgrid",
  testimonial: "testimonial",
  chatproof: "chat",
  textthread: "chat",
  notesapp: "notes",
  nativebubbles: "bubbles",
  carousel: "overlay",
};

// Width/height ratio of the photo slot inside each layout family, based on a
// 1:1 feed canvas. Used to pre-crop the photo so the render frames exactly what
// the live preview shows.
const FRAME_ASPECT: Partial<Record<Family, number>> = {
  split: 0.5,
  framed: 0.45,
  device: 0.5,
  spotlight: 1,
  collage: 1,
};

export function photoFrameAspect(template?: string, frame: "feed" | "story" = "feed"): number {
  const fam: Family = FAMILY[template || ""] || "overlay";
  const base = FRAME_ASPECT[fam] ?? 1;
  // Story canvas is 9:16, so every photo slot gets proportionally taller.
  // The spotlight circle stays square in both placements.
  if (frame === "story" && fam !== "spotlight") return base * (9 / 16);
  return base;
}


export function LiveAdPreview({
  copy,
  slides,
  isCarousel,
  template,
  templateLabel,
  colors,
  displayFamily,
  bodyFamily,
  photoUrl,
  backgroundUrl,
  textCase = "original",
  headlineScale = 1,
  bodyScale = 1,
  textBoxStyle = "none",
  textBoxColor,
  textBoxOpacity = 0.85,
  textPosition = "bottom",
  textAlign = "left",
  logoUrl,
  showLogo,
  logoCorner = "br",
  focalX = 50,
  focalY = 50,
  photoZoom = 1,
  onFocalChange,
  frame = "feed",
  bare = false,
  slideIndex,
}: {
  copy?: Copy;
  slides?: Copy[];
  isCarousel?: boolean;
  template?: string;
  templateLabel?: string;
  colors: PreviewColors;
  displayFamily?: string;
  bodyFamily?: string;
  photoUrl?: string;
  backgroundUrl?: string;
  textCase?: "original" | "upper" | "lower" | "title";
  headlineScale?: number;
  bodyScale?: number;
  textBoxStyle?: "none" | "box" | "scrim";
  textBoxColor?: string;
  textBoxOpacity?: number;
  textPosition?: "top" | "middle" | "bottom";
  textAlign?: "left" | "center" | "right";
  logoUrl?: string;
  showLogo?: boolean;
  logoCorner?: "tl" | "tr" | "bl" | "br";
  focalX?: number;
  focalY?: number;
  photoZoom?: number;
  onFocalChange?: (x: number, y: number) => void;
  frame?: "feed" | "story";
  /** Capture mode: draw only the ad canvas (no border, caption, or dots). */
  bare?: boolean;
  /** Force a specific carousel slide (used when exporting each slide). */
  slideIndex?: number;
}) {
  const [slideIdx, setSlideIdx] = useState(0);

  const total = slides?.length || 0;

  useEffect(() => {
    if (slideIdx > Math.max(0, total - 1)) setSlideIdx(0);
  }, [total, slideIdx]);

  const shownSlide = typeof slideIndex === "number" ? slideIndex : slideIdx;
  const active: Copy = isCarousel ? (slides?.[shownSlide] || {}) : (copy || {});
  const { headline, sub, eyebrow, cta } = linesFor(active);
  const hasAnything = headline || sub || eyebrow || cta;

  const family: Family = FAMILY[template || ""] || "overlay";
  const bgImage = backgroundUrl || photoUrl;
  const cornerClass = {
    tl: "top-3 left-3", tr: "top-3 right-3", bl: "bottom-3 left-3", br: "bottom-3 right-3",
  }[logoCorner];

  const T = (s: string) => applyCase(s, textCase);

  // Readability helpers: where the copy sits + an optional color box/scrim behind it.
  const justifyClass =
    textPosition === "top" ? "justify-start" : textPosition === "middle" ? "justify-center" : "justify-end";
  const alignItemsClass =
    textAlign === "center" ? "items-center text-center" : textAlign === "right" ? "items-end text-right" : "items-start text-left";
  const boxColor = textBoxColor || colors.bg;
  const boxStyle: React.CSSProperties =
    textBoxStyle === "box"
      ? { backgroundColor: boxColor, opacity: 1, borderRadius: "0.5rem", padding: "0.85rem 1rem" }
      : textBoxStyle === "scrim"
        ? { backgroundColor: boxColor, borderRadius: "0.75rem", padding: "0.85rem 1rem" }
        : {};
  const TextStack = ({ children }: { children: React.ReactNode }) => (
    <div
      className={`flex w-fit max-w-full flex-col gap-2 ${alignItemsClass}`}
      style={
        textBoxStyle === "none"
          ? undefined
          : textBoxStyle === "scrim"
            ? { ...boxStyle, backgroundColor: hexWithAlpha(boxColor, textBoxOpacity * 0.7) }
            : { ...boxStyle, backgroundColor: hexWithAlpha(boxColor, textBoxOpacity) }
      }
    >
      {children}
    </div>
  );
  const hFont = { fontFamily: displayFamily || undefined };
  const bFont = { fontFamily: bodyFamily || undefined };
  const hSize = (rem: number) => ({ fontSize: `${rem * headlineScale}rem` });
  const bSize = (rem: number) => ({ fontSize: `${rem * bodyScale}rem` });

  const Eyebrow = ({ className = "" }: { className?: string }) =>
    eyebrow ? (
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}
        style={{ color: colors.accent, ...bFont }}
      >
        {T(eyebrow)}
      </p>
    ) : null;

  // The render engine draws headlinePre / headlineHL / headlinePost as three
  // separately-colored runs (the HL run picks up the highlight color). The
  // preview has to do the same or it reads as a different design entirely.
  const hasSegments = Boolean(
    (active.headlinePre && active.headlinePre.trim()) ||
    (active.headlineHL && active.headlineHL.trim()) ||
    (active.headlinePost && active.headlinePost.trim())
  );

  const Headline = ({ size = 1.5, color = colors.ink, className = "" }: { size?: number; color?: string; className?: string }) => {
    if (hasSegments) {
      return (
        <p className={`font-bold leading-[1.06] ${className}`} style={{ color, ...hFont, ...hSize(size) }}>
          {active.headlinePre?.trim() && <span>{T(active.headlinePre.trim())} </span>}
          {active.headlineHL?.trim() && (
            <span style={{ color: colors.accent }}>{T(active.headlineHL.trim())} </span>
          )}
          {active.headlinePost?.trim() && <span>{T(active.headlinePost.trim())}</span>}
        </p>
      );
    }
    return headline ? (
      <p className={`font-bold leading-[1.06] ${className}`} style={{ color, ...hFont, ...hSize(size) }}>
        {T(headline)}
      </p>
    ) : null;
  };


  const Sub = ({ color = colors.ink, className = "" }: { color?: string; className?: string }) =>
    sub ? (
      <p className={`leading-snug opacity-85 ${className}`} style={{ color, ...bFont, ...bSize(0.8125) }}>
        {T(sub)}
      </p>
    ) : null;

  const Cta = ({ className = "" }: { className?: string }) =>
    cta ? (
      <span
        className={`inline-flex w-fit rounded-full px-3 py-1.5 text-[11px] font-semibold ${className}`}
        style={{ backgroundColor: colors.accent, color: colors.cream, ...bFont }}
      >
        {T(cta)}
      </span>
    ) : null;

  // Image framing: focal point (what stays visible when the photo is cropped
  // into the template frame) + zoom. Drag the photo in the preview to move it.
  const photoStyle: React.CSSProperties = {
    objectPosition: `${focalX}% ${focalY}%`,
    transform: photoZoom !== 1 ? `scale(${photoZoom})` : undefined,
    transformOrigin: `${focalX}% ${focalY}%`,
  };

  const startFocalDrag = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!onFocalChange) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = focalX;
    const baseY = focalY;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / Math.max(1, rect.width)) * 100;
      const dy = ((ev.clientY - startY) / Math.max(1, rect.height)) * 100;
      const clamp = (n: number) => Math.min(100, Math.max(0, n));
      onFocalChange(clamp(baseX - dx), clamp(baseY - dy));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const Photo = ({ className = "" }: { className?: string }) =>
    bgImage ? (
      <img
        src={bgImage}
        alt=""
        draggable={false}
        onPointerDown={startFocalDrag}
        style={photoStyle}
        className={`object-cover ${onFocalChange ? "cursor-move select-none" : ""} ${className}`}
      />
    ) : (
      <div className={`${className}`} style={{ backgroundColor: `${colors.accent}33` }} />
    );

  let body: React.ReactNode;

  switch (family) {
    case "split":
      body = (
        <div className="grid h-full grid-cols-2">
          <Photo className="h-full w-full" />
          <div className={`flex flex-col gap-2 p-4 ${justifyClass} ${alignItemsClass}`}>
            <TextStack>
              <Eyebrow />
              <Headline size={1.25} />
              <Sub />
              <Cta className="mt-1" />
            </TextStack>
          </div>
        </div>
      );
      break;

    case "framed":
      // Engine layout: photo fills the left half, copy panel on the right in
      // the background color, with a thin accent frame inset over the whole
      // canvas and the CTA pill sitting under the headline.
      body = (
        <>
          <div className="grid h-full grid-cols-[45%_1fr]">
            <Photo className="h-full w-full" />
            <div className="flex flex-col justify-center gap-2 px-4 py-5" style={{ backgroundColor: colors.bg }}>
              <Eyebrow />
              <Headline size={1.15} />
              <Sub />
              <Cta className="mt-2" />
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-3 border"
            style={{ borderColor: colors.accent }}
          />
        </>
      );
      break;


    case "spotlight":
      body = (
        <div className="flex h-full items-center justify-center p-5">
          <div
            className="flex w-full flex-col items-center gap-2 rounded-xl p-5 text-center"
            style={{ backgroundColor: colors.cream }}
          >
            <Photo className="h-16 w-16 rounded-full" />
            <Eyebrow />
            <Headline size={1.2} className="text-center" />
            <Sub className="text-center" />
            <Cta className="mt-1" />
          </div>
        </div>
      );
      break;

    case "device":
      body = (
        <div className="flex h-full items-center justify-center gap-3 p-4">
          <div className="flex h-[85%] w-[42%] items-stretch rounded-[14px] border-4 p-1" style={{ borderColor: colors.ink }}>
            <Photo className="h-full w-full rounded-[8px]" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Eyebrow />
            <Headline size={1.1} />
            <Sub />
            <Cta className="mt-1" />
          </div>
        </div>
      );
      break;

    case "collage":
      body = (
        <div className="flex h-full flex-col">
          <div className="grid flex-1 grid-cols-3 gap-1 p-1">
            <Photo className="col-span-2 row-span-2 h-full w-full rounded-sm" />
            <Photo className="h-full w-full rounded-sm" />
            <Photo className="h-full w-full rounded-sm" />
          </div>
          <div className="flex flex-col gap-1.5 p-4">
            <Headline size={1.15} />
            <Sub />
            <Cta className="mt-1" />
          </div>
        </div>
      );
      break;

    case "bigtype":
      body = (
        <div className={`flex h-full flex-col gap-3 p-6 ${justifyClass} ${alignItemsClass}`}>
          <TextStack>
            <Eyebrow />
            <Headline size={2.1} />
            <Sub />
            <Cta className="mt-1" />
          </TextStack>
        </div>
      );
      break;

    case "offer":
      body = (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <Eyebrow />
          <p className="font-black leading-none" style={{ color: colors.pop, ...hFont, ...hSize(2.6) }}>
            {T(firstText(active, ["offerBig", "discount", "headline"]) || headline)}
          </p>
          <Sub className="text-center" />
          {active.terms && (
            <p className="text-[10px] opacity-70" style={{ color: colors.ink, ...bFont }}>{active.terms}</p>
          )}
          <Cta className="mt-1" />
        </div>
      );
      break;

    case "event":
      body = (
        <div className="flex h-full flex-col justify-center gap-2 p-6">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: colors.accent }} />
          <Eyebrow />
          <Headline size={1.5} />
          <div className="flex flex-wrap gap-1.5">
            {[active.date, active.time, active.host, active.meta]
              .filter((x): x is string => !!x && !!x.trim())
              .map((x, i) => (
                <span
                  key={i}
                  className="rounded-full border px-2 py-0.5 text-[10px]"
                  style={{ borderColor: colors.accent, color: colors.ink, ...bFont }}
                >
                  {x}
                </span>
              ))}
          </div>
          <Sub />
          <Cta className="mt-1" />
        </div>
      );
      break;

    case "checklist": {
      const items = listOf(active, "item");
      body = (
        <div className="flex h-full flex-col justify-center gap-2 p-6">
          <Eyebrow />
          <Headline size={1.25} />
          <ul className="mt-1 space-y-1.5">
            {(items.length ? items : ["Your list items appear here"]).map((it, i) => (
              <li key={i} className="flex items-start gap-2" style={{ color: colors.ink, ...bFont, ...bSize(0.8125) }}>
                <span
                  className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                  style={{ backgroundColor: colors.accent, color: colors.cream }}
                >
                  ✓
                </span>
                <span>{T(it)}</span>
              </li>
            ))}
          </ul>
          <Cta className="mt-2" />
        </div>
      );
      break;
    }

    case "statgrid": {
      const stats = statsOf(active);
      body = (
        <div className="flex h-full flex-col justify-center gap-3 p-5">
          <Eyebrow />
          <Headline size={1.15} />
          <div className="grid grid-cols-2 gap-2">
            {(stats.length ? stats : [{ num: "00", label: "Stat" }, { num: "00", label: "Stat" }]).map((s, i) => (
              <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: `${colors.accent}1f` }}>
                <p className="font-bold leading-none" style={{ color: colors.accent, ...hFont, ...hSize(1.15) }}>{s.num}</p>
                <p className="mt-1 text-[10px] opacity-80" style={{ color: colors.ink, ...bFont }}>{s.label}</p>
              </div>
            ))}
          </div>
          <Cta />
        </div>
      );
      break;
    }

    case "testimonial":
      body = (
        <div className="flex h-full flex-col justify-center gap-3 p-6">
          <p className="font-serif leading-none" style={{ color: colors.accent, fontSize: "2.5rem" }}>&ldquo;</p>
          <p className="font-medium leading-snug" style={{ color: colors.ink, ...hFont, ...hSize(1.05) }}>
            {T(firstText(active, ["quote", "headline", "body"]))}
          </p>
          <div className="flex items-center gap-2">
            {bgImage && <img src={bgImage} alt="" style={{ objectPosition: `${focalX}% ${focalY}%` }} className="h-8 w-8 rounded-full object-cover" />}
            <div>
              <p className="text-[11px] font-semibold" style={{ color: colors.ink, ...bFont }}>
                {firstText(active, ["attribution", "name", "sub"])}
              </p>
              <p className="text-[10px] opacity-70" style={{ color: colors.ink, ...bFont }}>
                {firstText(active, ["role", "meta"])}
              </p>
            </div>
          </div>
          <Cta />
        </div>
      );
      break;

    case "chat": {
      const msgs = listOf(active, "msg", 6);
      body = (
        <div className="flex h-full flex-col justify-center gap-2 p-5">
          <Eyebrow />
          {(msgs.length ? msgs : [headline || "Message copy shows here"]).map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-[11px] leading-snug ${i % 2 ? "self-end" : "self-start"}`}
              style={{
                backgroundColor: i % 2 ? colors.accent : colors.cream,
                color: i % 2 ? colors.cream : colors.ink,
                ...bFont,
              }}
            >
              {m}
            </div>
          ))}
          <Cta className="mt-1" />
        </div>
      );
      break;
    }

    case "notes":
      body = (
        <div className="flex h-full items-center justify-center p-5">
          <div className="w-full rounded-xl p-4" style={{ backgroundColor: colors.cream }}>
            <div className="mb-2 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.pop }} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.highlight }} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
            </div>
            <p className="font-semibold leading-snug" style={{ color: colors.ink, ...hFont, ...hSize(1.05) }}>
              {T(headline)}
            </p>
            {(listOf(active, "line", 6).length ? listOf(active, "line", 6) : [sub].filter(Boolean)).map((l, i) => (
              <p key={i} className="mt-1.5 text-[11px] leading-snug" style={{ color: colors.ink, ...bFont }}>
                {l}
              </p>
            ))}
          </div>
        </div>
      );
      break;

    case "bubbles":
      body = (
        <>
          <Photo className="absolute inset-0 h-full w-full" />
          <div className="relative flex h-full flex-col items-center justify-center gap-2 p-6">
            {(listOf(active, "bubble", 4).length ? listOf(active, "bubble", 4) : [headline, sub].filter(Boolean) as string[]).map((b, i) => (
              <span
                key={i}
                className="rounded-full px-3 py-1.5 text-center text-[11px] font-semibold"
                style={{ backgroundColor: colors.cream, color: colors.ink, ...bFont }}
              >
                {T(b)}
              </span>
            ))}
          </div>
        </>
      );
      break;

    case "overlay":
    default:
      body = (
        <>
          {bgImage && <Photo className="absolute inset-0 h-full w-full" />}
          {bgImage && textBoxStyle === "none" && (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${colors.bg}f2 12%, ${colors.bg}66 55%, transparent 100%)` }}
            />
          )}
          <div className={`relative flex h-full flex-col gap-2 p-5 ${justifyClass} ${alignItemsClass}`}>
            <TextStack>
              <Eyebrow />
              <Headline />
              <Sub />
              <Cta className="mt-1" />
            </TextStack>
          </div>
        </>
      );
  }

  const canvas = (
    <div
      className={`relative w-full overflow-hidden ${bare ? "" : "rounded-lg border border-border"} ${frame === "story" ? "aspect-[9/16]" : "aspect-square"}`}
      // whiteSpace: pre-wrap so manual line breaks typed in the copy editor
      // render (and export) exactly where the user put them.
      style={{ backgroundColor: colors.bg, whiteSpace: "pre-wrap" }}
    >
      {body}

      {!hasAnything && !bare && (
        <div className="absolute inset-x-0 bottom-3 text-center">
          <p className="text-xs text-muted-foreground">Your copy will appear here as it's written.</p>
        </div>
      )}

      {showLogo && logoUrl && (
        <img
          src={logoUrl}
          alt=""
          className={`absolute h-7 w-7 rounded object-contain ${cornerClass}`}
          style={{ backgroundColor: `${colors.cream}cc` }}
        />
      )}
    </div>
  );

  if (bare) return canvas;

  return (
    <div className="space-y-2">
      {canvas}


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
        {templateLabel ? `${templateLabel} · ` : ""}
        This is exactly what gets exported.
      </p>
    </div>
  );
}
