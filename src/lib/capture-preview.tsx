import { createRoot } from "react-dom/client";
import { toCanvas } from "html-to-image";

import type { ComponentProps } from "react";
import { LiveAdPreview } from "@/components/creative/LiveAdPreview";

/**
 * WYSIWYG export.
 *
 * The user tunes the ad in <LiveAdPreview/>. Instead of re-describing that
 * design to an external render engine (which produced something that looked
 * nothing like the preview), we mount the SAME component offscreen at export
 * size and rasterize it. What you see is literally the file you get.
 */

export const EXPORT_SIZES = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
} as const;

/** Base CSS width the preview is designed at; scaled up for export. */
const BASE_WIDTH = 432;

type PreviewProps = ComponentProps<typeof LiveAdPreview>;

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
          setTimeout(resolve, 8000);
        }),
    ),
  );
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* fonts API unavailable — proceed */
  }
}

/** React 18 may commit asynchronously; wait until the subtree actually exists. */
async function waitForMount(host: HTMLElement, timeoutMs = 5000): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = host.firstElementChild as HTMLElement | null;
    if (el && el.getBoundingClientRect().height > 0) return el;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  const el = host.firstElementChild as HTMLElement | null;
  if (!el) throw new Error("Could not prepare the ad canvas for export. Please try again.");
  return el;
}


/**
 * Renders the preview offscreen and returns a base64 PNG (no data: prefix)
 * at true ad resolution.
 */
export async function captureAdPreview(
  props: PreviewProps,
  frame: "feed" | "story",
): Promise<{ base64: string; width: number; height: number; placement: string }> {
  const size = EXPORT_SIZES[frame];
  const scale = size.width / BASE_WIDTH;

  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${size.width}px`,
    `height:${size.height}px`,
    "pointer-events:none",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(
        // The preview is laid out at BASE_WIDTH but blown up to the real ad
        // size BEFORE rasterizing. We use CSS `zoom` (not `transform: scale`)
        // on purpose: `transform` rasterizes the subtree at its small layout
        // size and then magnifies that bitmap, which is what made brand photos
        // look grainy. `zoom` re-lays the subtree out at the larger size, so
        // photos decode at full resolution.
        <div
          style={{
            width: size.width,
            height: size.height,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: BASE_WIDTH,
              zoom: scale,
            } as React.CSSProperties}
          >
            <LiveAdPreview {...props} frame={frame} bare onFocalChange={undefined} />
          </div>
        </div>,

      );
      // Let React commit + layout settle.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const target = await waitForMount(host);
    await waitForImages(target);


    // Supersample: rasterize at 2x the final ad size, then downscale with
    // high-quality smoothing. Rasterizing straight at 1080 lets the browser
    // reuse the small, already-composited photo layer, which is what made
    // brand photos look soft. Capturing above target and stepping down keeps
    // every pixel of detail from the original upload.
    const SS = 2;
    const raw = await toCanvas(target, {
      pixelRatio: SS,
      width: size.width,
      height: size.height,
      cacheBust: true,
      backgroundColor: props.colors?.bg,
      skipAutoScale: true,
    });

    const out = document.createElement("canvas");
    out.width = size.width;
    out.height = size.height;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the ad canvas for export. Please try again.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(raw, 0, 0, raw.width, raw.height, 0, 0, size.width, size.height);
    const dataUrl = out.toDataURL("image/png");



    return {
      base64: dataUrl.split(",")[1] || "",
      width: size.width,
      height: size.height,
      placement: frame,
    };
  } finally {
    setTimeout(() => {
      try {
        root.unmount();
      } catch {
        /* already unmounted */
      }
      host.remove();
    }, 0);
  }
}
