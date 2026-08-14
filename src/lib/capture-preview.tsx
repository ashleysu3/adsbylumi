import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
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
    `width:${BASE_WIDTH}px`,
    "pointer-events:none",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(
        <div style={{ width: BASE_WIDTH }}>
          <LiveAdPreview {...props} frame={frame} bare onFocalChange={undefined} />
        </div>,
      );
      // Let React commit + layout settle.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const target = host.firstElementChild as HTMLElement;
    await waitForImages(target);

    const dataUrl = await toPng(target, {
      pixelRatio: scale,
      width: BASE_WIDTH,
      height: Math.round(size.height / scale),
      cacheBust: true,
      backgroundColor: props.colors?.bg,
      skipAutoScale: true,
    });

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
