// ============================================================================
// ffmpeg-renderer.ts (patch #17)
//
// Browser-side MP4 renderer that burns text overlays INTO a video file.
//
// Patch #17 changes:
//   - RenderOverlay gains optional `xy` (0–1 normalized of video size,
//     center-of-text). When present, the canvas writer positions text
//     absolutely at that point. When absent, falls back to the brand's
//     style.position (top/center/bottom) — same as before patch #17.
// ============================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export type OverlayType = 'hook' | 'insight' | 'transition' | 'cta';
export type EmphasisStyle = 'bold' | 'upper' | 'bold-upper';

export interface OverlayXY {
  x: number; // 0 (left) to 1 (right) — center of the text
  y: number; // 0 (top) to 1 (bottom) — center of the text
}

export interface RenderOverlay {
  text: string;
  startSeconds: number;
  endSeconds: number;
  type?: OverlayType;
  /** Per-overlay drag-positioned xy. Falls back to style.position when absent. */
  xy?: OverlayXY;
}

export interface RenderStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  position: 'top' | 'center' | 'bottom';
  textShadow: boolean;
  fontWeight?: 'normal' | 'bold' | 'black';
  letterCase?: 'as-typed' | 'upper' | 'lower' | 'title';
  textStrokeColor?: string | null;
  textStrokeWidth?: number;
  emphasizeHookCta?: boolean;
  emphasisBoost?: number;
  emphasisStyle?: EmphasisStyle;
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

function defaultXYFromPosition(p: RenderStyle['position']): OverlayXY {
  switch (p) {
    case 'top': return { x: 0.5, y: 0.08 };
    case 'center': return { x: 0.5, y: 0.5 };
    case 'bottom':
    default: return { x: 0.5, y: 0.92 };
  }
}

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

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Rasterize one overlay's text to a transparent PNG sized to the full
 * video canvas. The overlay is positioned at its xy (or the style's
 * fallback position) using the same center-anchored math as the live
 * preview.
 */
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

  const resolved = resolveOverlayRender(overlay, style);

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

  const lines = resolved.text.split('\n');
  const lineHeight = scaledFontSize * 1.15;
  const totalHeight = lines.length * lineHeight;

  // Resolve positioning: per-overlay xy wins, otherwise use the style's
  // top/center/bottom default. xy is the CENTER of the text bounding box.
  const xy = overlay.xy ?? defaultXYFromPosition(style.position);
  const xCenter = Math.max(0, Math.min(width, Math.round(xy.x * width)));
  let yCenter = Math.max(0, Math.min(height, Math.round(xy.y * height)));

  // Clamp so the text bounding box stays inside the frame. This matches
  // the preview's drag-clamp behavior so what you see really is what you
  // get, even if a user drags into a corner.
  const halfH = totalHeight / 2;
  yCenter = Math.max(halfH + 4, Math.min(height - halfH - 4, yCenter));

  const padX = scaledFontSize * 0.5;
  const padY = scaledFontSize * 0.2;

  // Background pill (skipped when bgOpacity is 0).
  if (style.bgOpacity > 0) {
    ctx.fillStyle = hexToRgba(style.bgColor, style.bgOpacity);
    lines.forEach((line, i) => {
      const metrics = ctx.measureText(line);
      const lineW = metrics.width;
      const y = yCenter - totalHeight / 2 + lineHeight * i + lineHeight / 2;
      const bgX = xCenter - lineW / 2 - padX;
      const bgY = y - lineHeight / 2 + padY;
      const bgW = lineW + padX * 2;
      const bgH = lineHeight - padY * 2;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    });
  }

  if (style.textShadow) {
    ctx.shadowColor = style.bgOpacity > 0 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.85)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = style.bgOpacity > 0 ? 2 : 3;
    ctx.shadowBlur = style.bgOpacity > 0 ? 4 : 10;
  }

  if (scaledStrokeWidth > 0 && style.textStrokeColor) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = style.textStrokeColor;
    ctx.lineWidth = scaledStrokeWidth * 2;
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => {
      const y = yCenter - totalHeight / 2 + lineHeight * i + lineHeight / 2;
      ctx.strokeText(line, xCenter, y);
    });
    ctx.restore();
  }

  ctx.fillStyle = style.textColor;
  lines.forEach((line, i) => {
    const y = yCenter - totalHeight / 2 + lineHeight * i + lineHeight / 2;
    ctx.fillText(line, xCenter, y);
  });

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
  });
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

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

async function ensureFontLoaded(family: string, weightCss: string): Promise<void> {
  try {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    await (document as any).fonts.load(`${weightCss} 48px "${family}"`);
  } catch {
    /* non-fatal */
  }
}

export async function renderVideoWithText(opts: RenderOptions): Promise<Blob> {
  const { videoUrl, overlays, style, onProgress } = opts;

  if (overlays.length === 0) {
    throw new Error('No overlays to render');
  }

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
