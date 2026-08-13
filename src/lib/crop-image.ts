/**
 * Crops an image around a focal point so the rendered ad frames the same part
 * of the photo the user positioned in the live preview.
 *
 * focalX / focalY are 0-100 percentages (50/50 = centered).
 * zoom >= 1 tightens the crop around the focal point.
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

  // Largest region of the source with the target aspect ratio, then zoomed in.
  let cropW = Math.min(img.naturalWidth, img.naturalHeight * aspect);
  let cropH = cropW / aspect;
  cropW /= z;
  cropH /= z;

  const maxX = img.naturalWidth - cropW;
  const maxY = img.naturalHeight - cropH;
  const sx = Math.min(maxX, Math.max(0, (focalX / 100) * img.naturalWidth - cropW / 2));
  const sy = Math.min(maxY, Math.max(0, (focalY / 100) * img.naturalHeight - cropH / 2));

  const outW = Math.round(Math.min(1600, cropW));
  const outH = Math.round(outW / aspect);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", 0.92);
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
