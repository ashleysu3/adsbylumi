import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ENGINE_URL = Deno.env.get("ENGINE_URL")!;
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "content-type": "application/json",
};

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), { status: 200, headers });

async function imageUrlToDataUrl(url: string) {
  const imageResponse = await fetch(url, {
    headers: { accept: "image/*,*/*;q=0.8" },
    redirect: "follow",
  });

  if (!imageResponse.ok) {
    throw new Error(`Uploaded image could not be downloaded: HTTP ${imageResponse.status}`);
  }

  const contentType = imageResponse.headers.get("content-type") || "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Uploaded file is not an image: ${contentType}`);
  }

  const contentLength = Number(imageResponse.headers.get("content-length") || "0");
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error("Uploaded image is too large. Please use an image under 8MB.");
  }

  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Uploaded image is too large. Please use an image under 8MB.");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const body = await req.json();
    const photoUrl = body?.photo?.url;
    const shouldRemoveBackground = body?.photo?.removeBackground === true;

    if (shouldRemoveBackground && typeof photoUrl === "string" && photoUrl.startsWith("http")) {
      const dataUrl = await imageUrlToDataUrl(photoUrl);
      body.photo = {
        ...body.photo,
        url: dataUrl,
        dataUrl,
      };
    }

    const r = await fetch(`${ENGINE_URL}/render`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ENGINE_KEY },
      body: JSON.stringify({ ...body, return: "base64" }),
    });
    const data = await r.json();
    if (!r.ok || data?.error) return json({ error: data?.error || `Render failed with HTTP ${r.status}` });
    return json(data);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) });
  }
});
