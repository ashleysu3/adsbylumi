// Public, read-only: returns a fresh signed URL for the Ad Pack VSL video.
// The `lead-magnet-assets` bucket is private (workspace policy blocks
// public buckets), so we can't just hand out a static public URL — we
// mint a short-lived signed URL server-side on every read.
//
// site_settings.vsl_video_url.value shape (new):
//   { path: "<userId>/vsl-main.mp4", bucket: "lead-magnet-assets" }
// Legacy shape (still supported for old rows):
//   { url: "https://.../object/public/..." }
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "vsl_video_url")
      .maybeSingle();

    const value = (data?.value ?? {}) as {
      path?: string;
      bucket?: string;
      url?: string;
    };

    let url: string | null = null;

    if (value.path) {
      const bucket = value.bucket || "lead-magnet-assets";
      // 24h signed URL — long enough to comfortably watch, short enough
      // that a rotated/removed video stops leaking quickly.
      const { data: signed, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(value.path, 60 * 60 * 24);
      if (error) {
        console.error("[get-vsl-video] sign error", error);
      } else {
        url = signed?.signedUrl ?? null;
      }
    } else if (typeof value.url === "string") {
      url = value.url;
    }

    return new Response(JSON.stringify({ url }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-vsl-video] error", err);
    return new Response(JSON.stringify({ url: null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
