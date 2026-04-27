import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface TextOverlay {
  text: string;
  timing?: string;
  type?: "hook" | "insight" | "transition" | "cta";
}

export type EmphasisStyle = "bold" | "uppercase" | "bold-uppercase";

export interface OverlayStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  position: "top" | "center" | "bottom";
  textShadow: boolean;
  ctaOverlayUrl?: string;
  /** Apply special styling to overlays of type 'hook' and 'cta' so they
   * stand out from regular insight/transition lines. Default true. */
  emphasizeHookCta?: boolean;
  /** Multiplier applied to fontSize for emphasized overlays (1.0 = no boost,
   * 1.3 = +30%). Default 1.3. */
  emphasisBoost?: number;
  /** How to visually emphasize hook/cta lines. Default 'bold-uppercase'. */
  emphasisStyle?: EmphasisStyle;
}

export const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  fontFamily: "Inter",
  fontSize: 32,
  textColor: "#FFFFFF",
  bgColor: "#000000",
  bgOpacity: 0.6,
  position: "bottom",
  textShadow: true,
  ctaOverlayUrl: undefined,
  emphasizeHookCta: true,
  emphasisBoost: 1.3,
  emphasisStyle: "bold-uppercase",
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

/** Returns whether an overlay should receive emphasis treatment. */
export function isEmphasized(overlay: TextOverlay, style: OverlayStyle): boolean {
  if (!style.emphasizeHookCta) return false;
  return overlay.type === "hook" || overlay.type === "cta";
}

/** Apply the configured letter-case transform for emphasized overlays. */
export function applyEmphasisCase(text: string, style: OverlayStyle): string {
  const mode = style.emphasisStyle ?? "bold-uppercase";
  if (mode === "uppercase" || mode === "bold-uppercase") return text.toUpperCase();
  return text;
}

/** Returns the font-weight CSS value for an emphasized overlay. */
export function getEmphasisFontWeight(style: OverlayStyle): number {
  const mode = style.emphasisStyle ?? "bold-uppercase";
  return mode === "bold" || mode === "bold-uppercase" ? 800 : 400;
}

export function VideoTextPreview({ videoUrl, overlays, style = DEFAULT_OVERLAY_STYLE, className, compact }: VideoTextPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => {
      setIsPlaying(true);
      setHasStarted(true);
    };
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  // Reserve top 1/8 and bottom 1/8 of the frame for Meta's profile photo / caption overlays
  const positionClass = {
    top: "top-[12.5%]",
    center: "top-1/2 -translate-y-1/2",
    bottom: "bottom-[12.5%]",
  }[style.position];

  const baseFontSize = compact ? Math.max(12, style.fontSize * 0.5) : style.fontSize * 0.6;
  const emphasisBoost = style.emphasisBoost ?? 1.3;

  // Determine if CTA overlay image should show — visible during CTA-type overlays or last 3 seconds
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleMeta = () => setDuration(video.duration || 0);
    video.addEventListener("loadedmetadata", handleMeta);
    return () => video.removeEventListener("loadedmetadata", handleMeta);
  }, []);

  // Pick exactly ONE overlay to display at a time so they no longer stack.
  // - When playing: show whichever overlay's timing window contains currentTime.
  // - When paused/stopped before play: preview the first overlay so the editor
  //   shows something useful (this matches the previous behavior, but capped
  //   to a single overlay instead of the full stack).
  // - Untimed overlays only show as the paused-preview fallback.
  const activeOverlayIndex: number = (() => {
    const timed = overlays
      .map((o, i) => ({ o, i, t: parseTimingString(o.timing) }))
      .filter((x): x is { o: TextOverlay; i: number; t: { start: number; end: number } } => x.t !== null);

    // 1. If a timed overlay covers currentTime, show it.
    const hit = timed.find((x) => currentTime >= x.t.start && currentTime < x.t.end);
    if (hit) return hit.i;

    // 2. If the video has started and we're between windows, show nothing.
    if (hasStarted) return -1;

    // 3. Editor-paused preview: show the first overlay (timed first, else any).
    if (timed.length > 0) return timed[0].i;
    return overlays.length > 0 ? 0 : -1;
  })();

  const showCtaImage = (() => {
    if (!style.ctaOverlayUrl) return false;
    const ctaOverlay = overlays.find((o) => o.type === "cta");
    if (ctaOverlay) {
      const timing = parseTimingString(ctaOverlay.timing);
      if (timing) return currentTime >= timing.start && currentTime < timing.end;
      return !isPlaying;
    }
    if (duration > 0 && currentTime >= duration - 3) return true;
    if (!isPlaying) return true;
    return false;
  })();

  const activeOverlay = activeOverlayIndex >= 0 ? overlays[activeOverlayIndex] : null;

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[400px]", className)}>
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

      {/* Active text overlay (only one at a time) */}
      {activeOverlay && (
        <div className={cn("absolute left-0 right-0 px-3 pointer-events-none z-10", positionClass)}>
          {(() => {
            const emphasized = isEmphasized(activeOverlay, style);
            const fontSize = emphasized ? baseFontSize * emphasisBoost : baseFontSize;
            const fontWeight = emphasized ? getEmphasisFontWeight(style) : 400;
            const text = emphasized ? applyEmphasisCase(activeOverlay.text, style) : activeOverlay.text;
            return (
              <div
                key={activeOverlayIndex}
                className="text-center transition-opacity duration-300"
                style={{ opacity: 1 }}
              >
                <span
                  style={{
                    fontFamily: style.fontFamily,
                    fontSize: `${fontSize}px`,
                    fontWeight,
                    color: style.textColor,
                    backgroundColor: hexToRgba(style.bgColor, style.bgOpacity),
                    textShadow: style.textShadow ? "0 2px 4px rgba(0,0,0,0.5)" : "none",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    display: "inline-block",
                    lineHeight: 1.3,
                    letterSpacing: emphasized && (style.emphasisStyle === "uppercase" || style.emphasisStyle === "bold-uppercase") ? "0.02em" : undefined,
                  }}
                >
                  {text}
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
