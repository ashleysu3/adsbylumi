import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// VideoTextPreview (patch #15)
//
// Live preview of a video with text overlays. Designed to match what the
// ffmpeg burn-in renderer produces as closely as possible.
//
// Key changes vs. patch #12/#13:
//   1. **Paused state shows ONE overlay at a time**, not all of them stacked.
//      Previously `|| !isPlaying` meant a paused video displayed every
//      overlay simultaneously — which is exactly how the composition
//      *doesn't* look in the final MP4. Now we find the overlay whose
//      timing window contains `currentTime` and show just that one; if no
//      overlay is active and the video is at t=0, we show the first
//      overlay as a preview anchor so the user can see their work.
//   2. **Emphasis for hook / CTA** — when the overlay type is `hook` or
//      `cta` and `emphasizeHookCta` is on (brand setting), we boost font
//      size and/or force bold + uppercase per the emphasis style. Matches
//      the renderer so preview === final output.
//   3. **Proportional font sizing** — the preview uses the same
//      `fontSize * (containerWidth / 540)` math as the renderer, so what
//      you see lines up with what ffmpeg writes into the MP4.
//   4. **Modernized DEFAULT_OVERLAY_STYLE** — Bebas Neue, uppercase, no
//      pill background (bgOpacity 0), strong drop shadow. The old
//      0.6-opacity black pill look felt dated.
// ============================================================================

export interface TextOverlay {
  text: string;
  timing?: string;
  type?: "hook" | "insight" | "transition" | "cta";
}

export type EmphasisStyle = "bold" | "upper" | "bold-upper";

export interface OverlayStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  position: "top" | "center" | "bottom";
  textShadow: boolean;
  ctaOverlayUrl?: string;
  // Extended (optional so old saved brand styles still work):
  letterCase?: "as-typed" | "upper" | "lower" | "title";
  fontWeight?: "normal" | "bold" | "black";
  // Hook/CTA emphasis. `undefined` is treated as "on with sane defaults"
  // so brands that saved a style before patch #15 automatically get the
  // new behavior without an explicit opt-in.
  emphasizeHookCta?: boolean;
  emphasisBoost?: number; // 0.0–1.0, applied to fontSize
  emphasisStyle?: EmphasisStyle;
}

export const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  fontFamily: "Bebas Neue",
  fontSize: 56,
  textColor: "#FFFFFF",
  bgColor: "#000000",
  bgOpacity: 0,
  position: "bottom",
  textShadow: true,
  ctaOverlayUrl: undefined,
  letterCase: "upper",
  fontWeight: "bold",
  emphasizeHookCta: true,
  emphasisBoost: 0.3,
  emphasisStyle: "bold-upper",
};

interface VideoTextPreviewProps {
  videoUrl: string;
  overlays: TextOverlay[];
  style?: OverlayStyle;
  className?: string;
  compact?: boolean;
}

function parseTimingString(timing?: string): { start: number; end: number } | null {
  if (!timing) return null;
  const match = timing.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (!match) return null;
  return { start: parseFloat(match[1]), end: parseFloat(match[2]) };
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function applyLetterCase(text: string, mode: OverlayStyle["letterCase"]): string {
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
    default:
      return text;
  }
}

/**
 * Given an overlay and the active style, compute the effective rendering
 * params (size, weight, transformed text). Shared with ffmpeg-renderer via
 * an equivalent implementation there, so the preview and the burned MP4
 * stay in sync.
 */
export function resolveOverlayRender(
  overlay: TextOverlay,
  style: OverlayStyle,
): {
  text: string;
  fontSize: number;
  fontWeight: "normal" | "bold" | "black";
} {
  const baseSize = style.fontSize;
  const baseWeight: "normal" | "bold" | "black" = style.fontWeight ?? "bold";
  const emphasize =
    (style.emphasizeHookCta ?? true) && (overlay.type === "hook" || overlay.type === "cta");

  let size = baseSize;
  let weight = baseWeight;
  let text = applyLetterCase(overlay.text, style.letterCase);

  if (emphasize) {
    const boost = Math.max(0, Math.min(1, style.emphasisBoost ?? 0.3));
    size = Math.round(baseSize * (1 + boost));
    const mode = style.emphasisStyle ?? "bold-upper";
    if (mode === "bold" || mode === "bold-upper") {
      // Promote to heavier weight. If already black, this is a no-op.
      weight = "black";
    }
    if (mode === "upper" || mode === "bold-upper") {
      text = text.toUpperCase();
    }
  }

  return { text, fontSize: size, fontWeight: weight };
}

export function VideoTextPreview({
  videoUrl,
  overlays,
  style = DEFAULT_OVERLAY_STYLE,
  className,
  compact,
}: VideoTextPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track playback state so we can show the "active at current time" overlay.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleMeta = () => setDuration(video.duration || 0);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleMeta);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleMeta);
    };
  }, []);

  // Measure container width so preview font size tracks the real render
  // (fontSize * width / 540 is what ffmpeg-renderer uses).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const positionClass = {
    top: "top-4",
    center: "top-1/2 -translate-y-1/2",
    bottom: "bottom-6",
  }[style.position];

  // ---------------------------------------------------------------------------
  // Find the overlay that should be visible RIGHT NOW.
  //
  // Rules:
  //   - If any overlay's timing window contains currentTime, show that one
  //     (first match wins if there's an overlap — same as the renderer).
  //   - If no overlay is active AND we're paused at t≈0, show the first
  //     overlay as a preview anchor so the editor isn't blank.
  //   - Otherwise show nothing (dead air between overlays is accurate to
  //     the rendered MP4).
  // ---------------------------------------------------------------------------
  const activeOverlayIndex = (() => {
    for (let i = 0; i < overlays.length; i++) {
      const t = parseTimingString(overlays[i].timing);
      if (t && currentTime >= t.start && currentTime < t.end) return i;
    }
    // Preview anchor when nothing is active + video is at the start + paused.
    if (!isPlaying && currentTime < 0.1 && overlays.length > 0) {
      return 0;
    }
    return -1;
  })();

  const activeOverlay = activeOverlayIndex >= 0 ? overlays[activeOverlayIndex] : null;

  // CTA overlay image (PNG mockup) — same behavior as before: shown during
  // CTA-type overlays or in the last 3 seconds.
  const showCtaImage = (() => {
    if (!style.ctaOverlayUrl) return false;
    const ctaOverlay = overlays.find(o => o.type === "cta");
    if (ctaOverlay) {
      const timing = parseTimingString(ctaOverlay.timing);
      if (timing) return currentTime >= timing.start && currentTime < timing.end;
      return !isPlaying;
    }
    if (duration > 0 && currentTime >= duration - 3) return true;
    if (!isPlaying) return true;
    return false;
  })();

  // Compute the preview font size based on actual container width. Mirror
  // of the renderer's math (referenced 540px). On a compact sidebar preview
  // the container is ~180px → font appears smaller, just like it will on a
  // 1080x1920 MP4 when someone watches at phone scale. Clamp so text never
  // disappears if container hasn't measured yet.
  const widthBasis = containerWidth || (compact ? 180 : 360);
  const sizeScale = widthBasis / 540;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[400px]",
        className,
      )}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        controls
        muted
        loop
        playsInline
        preload="metadata"
      />

      {/* CTA mockup PNG overlay */}
      {showCtaImage && style.ctaOverlayUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <img
            src={style.ctaOverlayUrl}
            alt="CTA overlay"
            className="max-w-[80%] max-h-[40%] object-contain drop-shadow-lg transition-opacity duration-500"
            style={{ opacity: showCtaImage ? 1 : 0 }}
          />
        </div>
      )}

      {/* Single active text overlay */}
      {activeOverlay && (
        <div
          className={cn(
            "absolute left-0 right-0 px-4 pointer-events-none z-10 text-center",
            positionClass,
          )}
        >
          {(() => {
            const resolved = resolveOverlayRender(activeOverlay, style);
            const fontSizePx = Math.max(10, Math.round(resolved.fontSize * sizeScale));
            const weightCss =
              resolved.fontWeight === "black"
                ? 900
                : resolved.fontWeight === "normal"
                  ? 400
                  : 700;

            return (
              <span
                style={{
                  fontFamily: `"${style.fontFamily}", Inter, sans-serif`,
                  fontWeight: weightCss,
                  fontSize: `${fontSizePx}px`,
                  color: style.textColor,
                  backgroundColor:
                    style.bgOpacity > 0 ? hexToRgba(style.bgColor, style.bgOpacity) : "transparent",
                  // Stronger shadow when there's no pill background — gives
                  // the "no box" variant enough contrast against busy video.
                  textShadow: style.textShadow
                    ? style.bgOpacity > 0
                      ? "0 2px 4px rgba(0,0,0,0.6)"
                      : "0 2px 6px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.5)"
                    : "none",
                  padding: style.bgOpacity > 0 ? "6px 14px" : "0",
                  borderRadius: style.bgOpacity > 0 ? "4px" : "0",
                  display: "inline-block",
                  lineHeight: 1.15,
                  letterSpacing: style.fontFamily === "Bebas Neue" ? "0.02em" : "normal",
                  whiteSpace: "pre-line",
                }}
              >
                {resolved.text}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}
