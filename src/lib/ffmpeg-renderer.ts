// ============================================================================
// ffmpeg-renderer.ts
//
// Browser-side MP4 renderer that burns text overlays INTO a video file so
// users can upload it to Meta (or anywhere else) and the text travels with
// the file. Uses `@ffmpeg/ffmpeg` (ffmpeg.wasm).
//
// Approach:
//   1. For each overlay, render the text to an HTML <canvas> using the
//      browser's native font rendering (same fonts that are already loaded
//      via OverlayStylePicker's Google Fonts <link>).
//   2. Export the canvas to PNG (with transparency for the uncovered area).
//   3. Load the source video + each PNG into ffmpeg's virtual filesystem.
//   4. Use ffmpeg's `overlay` filter with `enable=between(t, start, end)`
//      to composite the overlay PNG onto the video only during the
//      overlay's active window.
//   5. Export as MP4 Blob for the caller to download / upload.
//
// This avoids the `drawtext` filter entirely, which would need bundled
// .ttf files — the canvas approach lets us reuse whatever font the user
// already sees in the preview.
//
// Single-thread ffmpeg core (no SharedArrayBuffer required) so this works
// on any Lovable deploy without special CORS headers. Trade-off is speed:
// a 30-second clip takes ~30–60s to render on desktop, longer on mobile.
// We report progress via the onProgress callback.
// ============================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface RenderOverlay {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface RenderStyle {
  fontFamily: string;
  fontSize: number; // canvas px
  textColor: string; // hex
  bgColor: string; // hex
  bgOpacity: number; // 0–1
  position: 'top' | 'center' | 'bottom';
  textShadow: boolean;
}

export interface RenderOptions {
  videoUrl: string;
  overlays: RenderOverlay[];
  style: RenderStyle;
  onProgress?: (info: { pct: number; message: string }) => void;
}

export const DEFAULT_RENDER_STYLE: RenderStyle = {
  fontFamily: 'Inter',
  fontSize: 48,
  textColor: '#FFFFFF',
  bgColor: '#000000',
  bgOpacity: 0.6,
  position: 'bottom',
  textShadow: true,
};

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

    // Unpkg CDN for the core files. Using `toBlobURL` so the browser can
    // load them from a blob: URL, which avoids some cross-origin gotchas
    // with wasm module loading.
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
  text: string,
  style: RenderStyle,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Transparent base — overlay will composite over the video.
  ctx.clearRect(0, 0, width, height);

  // Try to scale font reasonably to video size. The `style.fontSize` is
  // the editor's chosen size against a 360px-wide preview; we scale up
  // proportionally so it looks the same on the real video dimensions.
  const scaledFontSize = Math.round(style.fontSize * (width / 540));

  ctx.font = `bold ${scaledFontSize}px "${style.fontFamily}", Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Split on explicit \n; no auto-wrap in v1.
  const lines = text.split('\n');
  const lineHeight = scaledFontSize * 1.3;
  const totalHeight = lines.length * lineHeight;

  // Vertical anchor by position choice.
  const padding = height * 0.05;
  const yCenter =
    style.position === 'top'
      ? totalHeight / 2 + padding
      : style.position === 'center'
        ? height / 2
        : height - totalHeight / 2 - padding;

  const padX = scaledFontSize * 0.5;
  const padY = scaledFontSize * 0.2;

  // Background boxes first (per line) so text can overlay them cleanly.
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

  // Shadow if enabled. Applied to text only, not background.
  if (style.textShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
  }

  ctx.fillStyle = style.textColor;
  lines.forEach((line, i) => {
    const y = yCenter - totalHeight / 2 + lineHeight * i + lineHeight / 2;
    ctx.fillText(line, width / 2, y);
  });

  // Export.
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

  // Progress handler — ffmpeg.wasm reports as 0–1.
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

    onProgress?.({ pct: 0, message: 'Building text overlays…' });
    for (let i = 0; i < overlays.length; i++) {
      const png = await renderTextToPng(overlays[i].text, style, width, height);
      await ffmpeg.writeFile(`overlay_${i}.png`, png);
    }

    // Build the filter_complex. Each overlay PNG is a separate input; we
    // chain them with `overlay` filters that enable only during the
    // overlay's time window. Audio stream (0:a) is copied through.
    //
    //   [0:v][1:v] overlay=0:0:enable='between(t,S1,E1)' [v1];
    //   [v1][2:v]  overlay=0:0:enable='between(t,S2,E2)' [v2];
    //   ...
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
      '-map', '0:a?', // audio is optional (silent clips still work)
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

    // Cleanup the virtual FS for this render so subsequent renders don't
    // OOM on long sessions.
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
