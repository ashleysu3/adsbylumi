import { supabase } from "@/integrations/supabase/client";

/**
 * Several storage buckets (broll-library, creative-assets, stock-broll) are
 * private, but a lot of saved rows still hold `/storage/v1/object/public/...`
 * links from when they weren't. Those links return a JSON error instead of the
 * file, which made the b-roll renderer say "we couldn't read your clip" even
 * for perfectly normal H.264 MP4s.
 *
 * `resolvePlayableUrl` turns any public-style Supabase storage link into a
 * short-lived signed URL. Anything else (blob:, data:, external CDN) is
 * returned untouched.
 */
const PUBLIC_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

const cache = new Map<string, { url: string; expires: number }>();

export async function resolvePlayableUrl(
  rawUrl: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  if (!rawUrl || rawUrl.startsWith("blob:") || rawUrl.startsWith("data:")) return rawUrl;

  const match = rawUrl.match(PUBLIC_RE);
  if (!match) return rawUrl;

  const cached = cache.get(rawUrl);
  if (cached && cached.expires > Date.now()) return cached.url;

  const bucket = match[1];
  const path = decodeURIComponent(match[2].split("?")[0]);

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) return rawUrl;
    cache.set(rawUrl, {
      url: data.signedUrl,
      expires: Date.now() + (expiresInSeconds - 60) * 1000,
    });
    return data.signedUrl;
  } catch {
    return rawUrl;
  }
}
