import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ENGINE_URL = Deno.env.get("ENGINE_URL")!;
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "content-type": "application/json",
};

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), { status: 200, headers });

function assertAllowedPhotoUrl(url: string) {
  const parsed = new URL(url);
  const storageHost = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : parsed.hostname;
  const allowedPath = parsed.pathname.startsWith("/storage/v1/object/sign/ad-photos/");

  if (parsed.protocol !== "https:" || parsed.hostname !== storageHost || !allowedPath) {
    throw new Error("Uploaded image URL is not from the ad photo library.");
  }
}

function makeProxyUrl(req: Request, imageUrl: string) {
  const proxyUrl = new URL(req.url);
  const imagePath = new URL(imageUrl).pathname;
  const filename = imagePath.split("/").pop() || "photo.png";
  const encodedImageUrl = btoa(imageUrl).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  proxyUrl.pathname = `${proxyUrl.pathname.replace(/\/$/, "")}/proxy/${encodedImageUrl}/${filename}`;
  proxyUrl.search = "";
  return proxyUrl.toString();
}

function decodeProxyImageUrl(req: Request) {
  const requestUrl = new URL(req.url);
  const proxyMatch = requestUrl.pathname.match(/\/proxy\/([^/]+)\//);
  const queryImageUrl = requestUrl.searchParams.get("proxy_image");

  if (!proxyMatch?.[1]) return queryImageUrl;

  const base64 = proxyMatch[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
}

async function fetchImage(url: string) {
  assertAllowedPhotoUrl(url);
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

  return { bytes, contentType };
}

async function uploadPublicEngineImage(bytes: Uint8Array, contentType: string) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const extension = contentType.includes("jpeg") ? "jpg" : contentType.split("/")[1]?.split(";")[0] || "png";
  const path = `ad-generator-render/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage.from("broll-library").upload(path, bytes, {
    cacheControl: "300",
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Could not prepare image for background removal: ${error.message}`);
  }

  const { data } = admin.storage.from("broll-library").getPublicUrl(path);
  return data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const proxyImageUrl = decodeProxyImageUrl(req);

    if ((req.method === "GET" || req.method === "HEAD") && proxyImageUrl) {
      const { bytes, contentType } = await fetchImage(proxyImageUrl);
      const imageHeaders = {
        ...corsHeaders,
        "content-type": contentType,
        "content-length": String(bytes.byteLength),
        "cache-control": "no-store",
      };

      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers: imageHeaders });
      }

      return new Response(bytes, {
        status: 200,
        headers: imageHeaders,
      });
    }

    const body = await req.json();
    const photoUrl = body?.photo?.url;
    const shouldRemoveBackground = body?.photo?.removeBackground === true;

    if (shouldRemoveBackground && typeof photoUrl === "string" && photoUrl.startsWith("http")) {
      const { bytes, contentType } = await fetchImage(photoUrl);
      body.photo = {
        ...body.photo,
        url: await uploadPublicEngineImage(bytes, contentType),
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
