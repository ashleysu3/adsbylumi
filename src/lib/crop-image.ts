/**
 * Crops an image around a focal point so the rendered ad frames the same part
 * of the photo the user positioned in the live preview.
 *
 * The math mirrors CSS `object-fit: cover` + `object-position: X% Y%` so the
 * result matches what the preview shows pixel-for-pixel:
 *   offset = (sourceSize - visibleSize) * (focal / 100)
 *
 * focalX / focalY are 0-100 percentages (50/50 = centered).
 * zoom >= 1 tightens the crop around the focal point.
 * aspect is the width/height ratio of the frame the photo sits in.
 */
export async function cropImageToFocal(
  url: string,
  focalX: number,
  focalY: number,
  zoom: number = 1,
  aspect: number = 1,
): Promise<string> {
  const img = await loadImage(url);
  const z = Math.max(1, zoom || 1);
  const a = aspect > 0 ? aspect : 1;

  // Largest region of the source with the target aspect ratio (cover), then
  // zoomed in around the focal point.
  let cropW = Math.min(img.naturalWidth, img.naturalHeight * a);
  let cropH = cropW / a;
  cropW /= z;
  cropH /= z;

  // object-position semantics: the leftover space is distributed by the focal %.
  const sx = (img.naturalWidth - cropW) * (Math.min(100, Math.max(0, focalX)) / 100);
  const sy = (img.naturalHeight - cropH) * (Math.min(100, Math.max(0, focalY)) / 100);

  const outW = Math.round(Math.min(2400, cropW));
  const outH = Math.max(1, Math.round(outW / a));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", 0.95);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for cropping"));
    img.src = url;
  });
}
