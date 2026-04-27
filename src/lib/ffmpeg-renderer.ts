// ============================================================================
// ffmpeg-renderer.ts (patch #15)
//
// Browser-side MP4 renderer that burns text overlays INTO a video file so
// users can upload it to Meta (or anywhere else) and the text travels with
// the file. Uses `@ffmpeg/ffmpeg` (ffmpeg.wasm).
//
// Approach:
//   1. For each overlay, render the text to an HTML <canvas> using the
//      browser's native font rendering (fonts are preloaded globally from
//      index.html so we don't depend on any particular screen mounting
//      a Google Fonts <link>).
//   2. Export the canvas to PNG (transparent outside the text area).
//   3. Load the source video + each PNG into ffmpeg's virtual filesystem.
//   4. Use ffmpeg's `overlay` filter with `enable=between(t, start, end)`
//      to composite the overlay PNG onto the video only during the
//      overlay's active window.
//   5. Export as MP4 Blob for the caller to download / upload.
//
// Patch #15 changes:
//   - RenderOverlay gains optional `type` ('hook' | 'insight' | 'transition'
//     | 'cta') and RenderStyle gains emphasis fields (mirror of OverlayStyle
//     on the frontend). The renderer uses these to auto-boost hook/CTA
//     lines — same logic as VideoTextPreview.resolveOverlayRender so
//     preview and burned MP4 stay in sync.
//   - DEFAULT_RENDER_STYLE modernized (Bebas Neue, upper, no pill).
// ============================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export type OverlayType = 'hook' | 'insight' | 'transition' | 'cta';
export type EmphasisStyle = 'bold' | 'upper' | 'bold-upper';

export interface RenderOverlay {
  text: string;
  startSeconds: number;
  endSeconds: number;
  // Optional — drives hook/CTA emphasis. Falls back to 'insight' when
  // absent (no emphasis applied).
  type?: OverlayType;
}

export interface RenderStyle {
  fontFamily: string;
  fontSize: number; // canvas px
  textColor: string; // hex
  bgColor: string; // hex
  bgOpacity: number; // 0–1
  position: 'top' | 'center' | 'bottom';
  textShadow: boolean;
  // Extended (patch #13 templates). Optional so existing callers keep
  // working without changes.
  fontWeight?: 'normal' | 'bold' | 'black'; // defaults to 'bold'
  letterCase?: 'as-typed' | 'upper' | 'lower' | 'title'; // defaults to 'as-typed'
  textStrokeColor?: string | null; // null = no stroke
  textStrokeWidth?: number; // px, 0 = no stroke
  // Emphasis (patch #15). Auto-applied to hook / cta overlays when on.
  emphasizeHookCta?: boolean; // default true
  emphasisBoost?: number; // 0.0–1.0, applied to fontSize (default 0.3)
  emphasisStyle?: EmphasisStyle; // default 'bold-upper'
}

export interface RenderOptions {
  videoUrl: string;
  overlays: RenderOverlay[];
  style: RenderStyle;
  onProgress?: (info: { pct: number; message: string }) => void;
}

export const DEFAULT_RENDER_STYLE: RenderStyle = {
  fontFamily: 'Bebas Neue',
  fontSize: 56,
  textColor: '#FFFFFF',
  bgColor: '#000000',
  bgOpacity: 0,
  position: 'bottom',
  textShadow: true,
  fontWeight: 'bold',
  letterCase: 'upper',
  textStrokeColor: null,
  textStrokeWidth: 0,
  emphasizeHookCta: true,
  emphasisBoost: 0.3,
  emphasisStyle: 'bold-upper',
};

/** Normalize text per the chosen letter-case transform. Applied before
 *  canvas rendering so both the preview and the rendered MP4 match. */
function applyLetterCase(text: string, mode: RenderStyle['letterCase']): string {
  switch (mode) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title':
      return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
    case 'as-typed':
    default:
      return text;
  }
}

/**
 * Given a single overlay + the active style, compute the effective render
 * parameters (text, fontSize, fontWeight). Mirrors VideoTextPreview's
 * resolveOverlayRender so preview and MP4 are consistent.
 */
function resolveOverlayRender(
  overlay: RenderOverlay,
  style: RenderStyle,
): { text: string; fontSize: number; fontWeight: 'normal' | 'bold' | 'black' } {
  const baseSize = style.fontSize;
  const baseWeight: 'normal' | 'bold' | 'black' = style.fontWeight ?? 'bold';
  const emphasize =
    (style.emphasizeHookCta ?? true) && (overlay.type === 'hook' || overlay.type === 'cta');

  let size = baseSize;
  let weight = baseWeight;
  let text = applyLetterCase(overlay.text, style.letterCase);

  if (emphasize) {
    const boost = Math.max(0, Math.min(1, style.emphasisBoost ?? 0.3));
    size = Math.round(baseSize * (1 + boost));
    const mode = style.emphasisStyle ?? 'bold-upper';
    if (mode === 'bold' || mode === 'bold-upper') {
      weight = 'black';
    }
    if (mode === 'upper' || mode === 'bold-upper') {
      text = text.toUpperCase();
    }
  }

  return { text, fontSize: size, fontWeight: weight };
}

// ---------------------------------------------------------------------------
// Singleton ffmpeg instance. Loading the wasm core is expensive (~25 MB
// download + init), so we do it once per page lifecycle and reuse.
// ---------------------------------------------------------------------------
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(
  onProgress?: (message: string) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    onProgress?.('Loading video engine…');
    const ffmpeg = new FFmpeg();

    const baseURL = 'https://unpkg.com/@ffmpeg/[email protected]/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

// ---------------------------------------------------------------------------
// Canvas-based text → PNG renderer. Matches the visual contract of
// VideoTextPreview so the exported file looks like the in-app preview.
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

async function renderTextToPng(
  overlay: RenderOverlay,
  style: RenderStyle,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.clearRect(0, 0, width, height);

  // Resolve emphasis — hook / CTA get a size bump + weight/case override.
  const resolved = resolveOverlayRender(overlay, style);

  // Scale the resolved (post-emphasis) font size up to the real video
  // dimensions. 540px-wide reference matches the preview container math.
  const scaledFontSize = Math.round(resolved.fontSize * (width / 540));
  const scaledStrokeWidth = Math.max(
    0,
    Math.round((style.textStrokeWidth || 0) * (width / 540)),
  );
  const weightCss = resolved.fontWeight === 'black'
    ? '900'
    : resolved.fontWeight === 'normal'
      ? '400'
      : '700';

  ctx.font = `${weightCss} ${scaledFontSize}px "${style.fontFamily}", Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Split on explicit \n; no auto-wrap in v1.
  const lines = resolved.text.split('\n');
  const lineHeight = scaledFontSize * 1.15;
  const totalHeight = lines.length * lineHeight;

  // Vertical anchor by position choice.
  const padding = height * 0.06;
  const yCenter =
    style.position === 'top'
      ? totalHeight / 2 + padding
      : style.position === 'center'
        ? height / 2
        : height - totalHeight / 2 - padding;

  const padX = scaledFontSize * 0.5;
  const padY = scaledFontSize * 0.2;

  // Background boxes first (per line) so text can overlay them cleanly.
  // Skipped entirely when bgOpacity is 0 — matches the preview's no-pill
  // rendering for the modern default look.
  if (style.bgOpacity > 0) {
    ctx.fillStyle = hexToRgba(style.bgColor, style.bgOpacity);
    lines.forEach((line, i) => {
      const metrics = ctx.measureText(line);
      const lineW = metrics.width;
      const y = yCenter - totalHeight / 2 + lineHeight * i + lineHeight / 2;
      const bgX = (width - lineW) / 2 - padX;
      const bgY = y - lineHeight / 2 + padY;
      const bgW = lineW + padX * 2;
      const bgH = lineHeight - padY * 2;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    });
  }

  // Shadow if enabled. Applied to text only, not background. Stronger when
  // there's no pill background — the shadow has to carry readability on its
  // own. Matches VideoTextPreview's CSS.
  if (style.textShadow) {
    ctx.shadowColor = style.bgOpacity > 0 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.85)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = style.bgOpacity > 0 ? 2 : 3;
    ctx.shadowBlur = style.bgOpacity > 0 ? 4 : 10;
  }

  // Stroke pass first (underneath the fill) so fill visually sits on top.
  // Skip shadow on stroke pass to avoid a shadowed-outline look.
  if (scaledStrokeWidth > 0 && style.textStrokeColor) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = style.textStrokeColor;
    ctx.lineWidth = scaledStrokeWidth * 2; // canvas strokes center on path, so 2x for visual width
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => {
      const y = yCenter - totalHeight / 2 + lineHeight * i + lineHeight / 2;
      ctx.strokeText(line, width / 2, y);
    });
    ctx.restore();
  }

  ctx.fillStyle = style.textColor;
  lines.forEach((line, i) => {
    const y = yCenter - totalHeight / 2 + lineHeight * i + lineHeight / 2;
    ctx.fillText(line, width / 2, y);
  });

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
  });
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// Read video dimensions so the overlay PNG matches the video size exactly.
// ---------------------------------------------------------------------------

function readVideoDimensions(videoUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.src = videoUrl;
    v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => reject(new Error('Could not read video metadata'));
  });
}

/**
 * Try to ensure the requested font face is actually loaded before we
 * paint to canvas. Without this the first overlay in a render can fall
 * back to sans-serif while the Google Fonts stylesheet is still fetching
 * the woff2 file. `document.fonts.load()` is safe to call for any family —
 * it resolves immediately if the font is already loaded.
 */
async function ensureFontLoaded(family: string, weightCss: string): Promise<void> {
  try {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    await (document as any).fonts.load(`${weightCss} 48px "${family}"`);
  } catch {
    // Non-fatal — fall back to whatever the browser has.
  }
}

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------

export async function renderVideoWithText(opts: RenderOptions): Promise<Blob> {
  const { videoUrl, overlays, style, onProgress } = opts;

  if (overlays.length === 0) {
    throw new Error('No overlays to render');
  }

  // Phase 1: load engine (only first time is slow).
  const ffmpeg = await getFFmpeg(msg => onProgress?.({ pct: 0, message: msg }));

  const progressListener = ({ progress }: { progress: number }) => {
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    onProgress?.({ pct, message: `Rendering… ${pct}%` });
  };
  ffmpeg.on('progress', progressListener);

  try {
    onProgress?.({ pct: 0, message: 'Reading video dimensions…' });
    const { width, height } = await readVideoDimensions(videoUrl);
    if (!width || !height) throw new Error('Video has no dimensions');

    onProgress?.({ pct: 0, message: 'Fetching video…' });
    const videoBytes = await fetchFile(videoUrl);
    await ffmpeg.writeFile('input.mp4', videoBytes);

    // Make sure the chosen font is in the browser's font cache before we
    // rasterize any overlay. Preload 400/700/900 since emphasis may push
    // to 900 and the base might be 400 or 700.
    onProgress?.({ pct: 0, message: 'Preparing fonts…' });
    await Promise.all([
      ensureFontLoaded(style.fontFamily, '400'),
      ensureFontLoaded(style.fontFamily, '700'),
      ensureFontLoaded(style.fontFamily, '900'),
    ]);

    onProgress?.({ pct: 0, message: 'Building text overlays…' });
    for (let i = 0; i < overlays.length; i++) {
      const png = await renderTextToPng(overlays[i], style, width, height);
      await ffmpeg.writeFile(`overlay_${i}.png`, png);
    }

    // Build the filter_complex. Each overlay PNG is a separate input; we
    // chain them with `overlay` filters that enable only during the
    // overlay's time window. Audio stream (0:a) is copied through.
    const filterParts: string[] = [];
    let prev = '[0:v]';
    overlays.forEach((o, i) => {
      const next = i === overlays.length - 1 ? '[vout]' : `[v${i + 1}]`;
      const input = `[${i + 1}:v]`;
      filterParts.push(
        `${prev}${input}overlay=0:0:enable='between(t\\,${o.startSeconds}\\,${o.endSeconds})'${next}`,
      );
      prev = next;
    });
    const filterComplex = filterParts.join(';');

    const args: string[] = ['-i', 'input.mp4'];
    for (let i = 0; i < overlays.length; i++) {
      args.push('-i', `overlay_${i}.png`);
    }
    args.push(
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      'output.mp4',
    );

    onProgress?.({ pct: 0, message: 'Rendering…' });
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile('output.mp4');
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as any);

    try { await ffmpeg.deleteFile('input.mp4'); } catch { /* ignore */ }
    for (let i = 0; i < overlays.length; i++) {
      try { await ffmpeg.deleteFile(`overlay_${i}.png`); } catch { /* ignore */ }
    }
    try { await ffmpeg.deleteFile('output.mp4'); } catch { /* ignore */ }

    onProgress?.({ pct: 100, message: 'Done' });
    return new Blob([bytes], { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', progressListener);
  }
}
