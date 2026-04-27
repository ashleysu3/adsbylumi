import { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// VideoTextPreview (patch #17)
//
// Live preview of a video with text overlays. Designed to match what the
// ffmpeg burn-in renderer produces.
//
// Patch #17 changes:
//   1. Per-overlay positioning. Each overlay can carry its own `xy` (0–1
//      normalized of video dimensions, referencing the CENTER of the text
//      bounding box). When absent, falls back to the brand's `position`
//      setting (top / center / bottom). Lets users drop the hook at the
//      top of one frame and the CTA at the bottom of another.
//   2. Drag-to-position. When `editable` is true and the video is paused,
//      all overlays render simultaneously and each is draggable. Releasing
//      a drag fires `onOverlayPositionChange(idx, xy)` so the parent can
//      persist the new position via the existing onOverlaysChange path.
//   3. Editable mode opt-in. Live playback (and preview-only contexts like
//      the small in-card thumbnail when `editable` is false) keep the
//      patch #15 behavior: one overlay at a time at the active timestamp.
// ============================================================================

export interface OverlayXY {
  x: number; // 0 (left) to 1 (right) — center of the text
  y: number; // 0 (top) to 1 (bottom) — center of the text
}

export interface TextOverlay {
  text: string;
  timing?: string;
  type?: "hook" | "insight" | "transition" | "cta";
  /** Optional drag-positioned xy. Falls back to style.position when absent. */
  xy?: OverlayXY;
  /** Max text-box width as a fraction (0-1) of the video width. Default 0.92. */
  width?: number;
  /** Per-overlay font-size multiplier on top of the style's base size. Default 1. */
  scale?: number;
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
  letterCase?: "as-typed" | "upper" | "lower" | "title";
  fontWeight?: "normal" | "bold" | "black";
  emphasizeHookCta?: boolean;
  emphasisBoost?: number;
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
  /** When true and the video is paused, all overlays render simultaneously
   *  and are draggable. Use this for editor surfaces; leave false for
   *  read-only previews (thumbnails, ad-mockup tiles, etc.). */
  editable?: boolean;
  /** Called when the user finishes dragging an overlay. The parent should
   *  update overlays[idx].xy and persist via its overlay-change pipeline. */
  onOverlayPositionChange?: (idx: number, xy: OverlayXY) => void;
  /** Called when the user finishes resizing an overlay (right edge → width,
   *  bottom-right corner → font scale). Either field may be present. */
  onOverlayResize?: (idx: number, patch: { width?: number; scale?: number }) => void;
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
 * Map the brand-level position setting (top/center/bottom) to an xy that
 * the renderer can use as a default when an overlay doesn't have its own
 * dragged position.
 */
export function defaultXYFromPosition(p: OverlayStyle["position"]): OverlayXY {
  switch (p) {
    case "top":
      return { x: 0.5, y: 0.08 };
    case "center":
      return { x: 0.5, y: 0.5 };
    case "bottom":
    default:
      return { x: 0.5, y: 0.92 };
  }
}

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
      weight = "black";
    }
    if (mode === "upper" || mode === "bold-upper") {
      text = text.toUpperCase();
    }
  }

  return { text, fontSize: size, fontWeight: weight };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function VideoTextPreview({
  videoUrl,
  overlays,
  style = DEFAULT_OVERLAY_STYLE,
  className,
  compact,
  editable = false,
  onOverlayPositionChange,
  onOverlayResize,
}: VideoTextPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Drag state — local only, committed to parent via onOverlayPositionChange
  // when the pointer is released.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragXY, setDragXY] = useState<OverlayXY | null>(null);

  // Resize state. Mode 'width' tracks horizontal drag → overlay.width fraction.
  // Mode 'scale' tracks corner drag → overlay.scale multiplier (uses initial
  // pointer offset from overlay center to compute a stable scaling factor).
  const [resizeIdx, setResizeIdx] = useState<number | null>(null);
  const [resizeMode, setResizeMode] = useState<"width" | "scale" | null>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [liveScale, setLiveScale] = useState<number | null>(null);
  const resizeStartRef = useRef<{
    initialDistance: number;
    initialScale: number;
    centerClientX: number;
    centerClientY: number;
  } | null>(null);

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

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Decide which overlays to render this frame.
  //
  //   - In editable mode + paused: render ALL overlays so the user can drop
  //     each one onto the right spot.
  //   - In editable mode + playing: same as non-editable (one at a time).
  //   - In non-editable mode: one at a time at currentTime, with the first
  //     overlay shown as a preview anchor when paused at t≈0.
  // ---------------------------------------------------------------------------
  const isStackedEditMode = editable && !isPlaying && overlays.length > 0;

  const visibleIndexes: number[] = (() => {
    if (isStackedEditMode) {
      return overlays.map((_, i) => i);
    }
    for (let i = 0; i < overlays.length; i++) {
      const t = parseTimingString(overlays[i].timing);
      if (t && currentTime >= t.start && currentTime < t.end) return [i];
    }
    if (!isPlaying && currentTime < 0.1 && overlays.length > 0) return [0];
    return [];
  })();

  // Which overlay is "active" at the current playhead — used to highlight
  // the live one when all overlays are stacked in edit mode.
  const activeIndexAtPlayhead: number | null = (() => {
    for (let i = 0; i < overlays.length; i++) {
      const t = parseTimingString(overlays[i].timing);
      if (t && currentTime >= t.start && currentTime < t.end) return i;
    }
    return null;
  })();

  // CTA mockup PNG overlay (unchanged from patch #15 logic).
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

  // Mirror of the renderer's font-size math (referenced 540px). Use the
  // measured container width so what you see matches what ffmpeg writes.
  const widthBasis = containerWidth || (compact ? 180 : 360);
  const sizeScale = widthBasis / 540;

  // ---------------------------------------------------------------------------
  // Drag handling. We use pointer events so this works on mouse, pen and
  // touch. We intentionally stop propagation so the underlying <video>
  // doesn't grab the click and play/pause.
  // ---------------------------------------------------------------------------

  const computeXYFromPointer = useCallback(
    (clientX: number, clientY: number): OverlayXY | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const x = clamp01((clientX - rect.left) / rect.width);
      const y = clamp01((clientY - rect.top) / rect.height);
      return { x, y };
    },
    [],
  );

  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const xy = computeXYFromPointer(e.clientX, e.clientY);
    setDragIdx(idx);
    setDragXY(xy);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const xy = computeXYFromPointer(e.clientX, e.clientY);
    if (xy) setDragXY(xy);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const xy = computeXYFromPointer(e.clientX, e.clientY) ?? dragXY;
    const idx = dragIdx;
    setDragIdx(null);
    setDragXY(null);
    if (xy && onOverlayPositionChange) {
      onOverlayPositionChange(idx, xy);
    }
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // ---------------------------------------------------------------------------
  // Resize handlers. Right-edge handle adjusts overlay.width (controls the
  // wrapping max width → fewer/more lines). Bottom-right corner adjusts
  // overlay.scale (font-size multiplier). Both commit on pointer-up.
  // ---------------------------------------------------------------------------

  const startResize = (
    e: React.PointerEvent,
    idx: number,
    mode: "width" | "scale",
    overlay: TextOverlay,
  ) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xy = overlay.xy ?? defaultXYFromPosition(style.position);
    const centerClientX = rect.left + xy.x * rect.width;
    const centerClientY = rect.top + xy.y * rect.height;
    const initialDistance = Math.max(
      8,
      Math.hypot(e.clientX - centerClientX, e.clientY - centerClientY),
    );

    setResizeIdx(idx);
    setResizeMode(mode);
    setLiveWidth(overlay.width ?? 0.92);
    setLiveScale(overlay.scale ?? 1);
    resizeStartRef.current = {
      initialDistance,
      initialScale: overlay.scale ?? 1,
      centerClientX,
      centerClientY,
    };
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (resizeIdx === null || !resizeMode) return;
    const el = containerRef.current;
    const start = resizeStartRef.current;
    if (!el || !start) return;
    const rect = el.getBoundingClientRect();

    if (resizeMode === "width") {
      // Distance from overlay center to pointer's X → half-width.
      const halfWidthPx = Math.abs(e.clientX - start.centerClientX);
      const fullWidthPx = halfWidthPx * 2;
      const fraction = Math.max(0.2, Math.min(1, fullWidthPx / rect.width));
      setLiveWidth(fraction);
    } else {
      const distance = Math.max(
        8,
        Math.hypot(e.clientX - start.centerClientX, e.clientY - start.centerClientY),
      );
      const ratio = distance / start.initialDistance;
      const next = Math.max(0.5, Math.min(2.5, start.initialScale * ratio));
      setLiveScale(next);
    }
  };

  const endResize = (e: React.PointerEvent) => {
    if (resizeIdx === null || !resizeMode) return;
    const idx = resizeIdx;
    const mode = resizeMode;
    const w = liveWidth;
    const s = liveScale;
    setResizeIdx(null);
    setResizeMode(null);
    setLiveWidth(null);
    setLiveScale(null);
    resizeStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!onOverlayResize) return;
    if (mode === "width" && w !== null) {
      onOverlayResize(idx, { width: Number(w.toFixed(3)) });
    } else if (mode === "scale" && s !== null) {
      onOverlayResize(idx, { scale: Number(s.toFixed(2)) });
    }
  };

  // ---------------------------------------------------------------------------
  // Render a single overlay at its computed xy. Position is absolute (left/
  // top in %) with a translate(-50%, -50%) so the xy refers to the CENTER of
  // the text bounding box.
  // ---------------------------------------------------------------------------
  const renderOverlay = (overlay: TextOverlay, idx: number) => {
    const resolved = resolveOverlayRender(overlay, style);
    const fontSizePx = Math.max(10, Math.round(resolved.fontSize * sizeScale));
    const weightCss =
      resolved.fontWeight === "black"
        ? 900
        : resolved.fontWeight === "normal"
          ? 400
          : 700;

    const liveXY: OverlayXY =
      dragIdx === idx && dragXY
        ? dragXY
        : overlay.xy ?? defaultXYFromPosition(style.position);

    const dragging = dragIdx === idx;
    const dimmedInStack =
      isStackedEditMode &&
      activeIndexAtPlayhead !== null &&
      activeIndexAtPlayhead !== idx;

    return (
      <div
        key={idx}
        className={cn(
          "absolute select-none transition-shadow",
          editable
            ? dragging
              ? "cursor-grabbing ring-2 ring-primary/60 ring-offset-1 ring-offset-black/30 rounded"
              : "cursor-grab hover:ring-1 hover:ring-primary/40 rounded"
            : "pointer-events-none",
        )}
        style={{
          left: `${liveXY.x * 100}%`,
          top: `${liveXY.y * 100}%`,
          transform: "translate(-50%, -50%)",
          maxWidth: "92%",
          textAlign: "center",
          touchAction: "none",
          zIndex: 10 + idx,
          opacity: dimmedInStack ? 0.45 : 1,
        }}
        onPointerDown={editable ? e => handlePointerDown(e, idx) : undefined}
        onPointerMove={editable ? handlePointerMove : undefined}
        onPointerUp={editable ? handlePointerUp : undefined}
        onPointerCancel={editable ? handlePointerUp : undefined}
      >
        {isStackedEditMode && (
          <span
            className="absolute -top-2 -left-2 z-20 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow"
            style={{ pointerEvents: "none" }}
          >
            {idx + 1}
          </span>
        )}
        <span
          style={{
            fontFamily: `"${style.fontFamily}", Inter, sans-serif`,
            fontWeight: weightCss,
            fontSize: `${fontSizePx}px`,
            color: style.textColor,
            backgroundColor:
              style.bgOpacity > 0 ? hexToRgba(style.bgColor, style.bgOpacity) : "transparent",
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
      </div>
    );
  };

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

      {/* Text overlays */}
      {visibleIndexes.map(i => renderOverlay(overlays[i], i))}

      {/* Edit-mode badge: makes it explicit that all overlays are stacked
          for editing, not playing in real-time order. */}
      {isStackedEditMode && (
        <div className="absolute top-2 left-2 z-30 inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/95 pointer-events-none shadow">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
          Edit mode · all overlays shown
        </div>
      )}

      {/* Drag affordance hint when in editable mode */}
      {editable && !isPlaying && overlays.length > 0 && (
        <div className="absolute bottom-1 left-1 right-1 text-center text-[10px] text-white/80 pointer-events-none z-30 drop-shadow">
          Drag any text to reposition · Press play to preview real timing
        </div>
      )}
    </div>
  );
}
