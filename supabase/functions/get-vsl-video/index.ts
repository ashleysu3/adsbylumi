// Public, read-only: returns just the VSL video URL for /your-ad-pack.
// A dedicated function rather than a direct client read of site_settings,
// since that table's "anyone can read" RLS policy is scoped to
// `authenticated` — a genuinely cold visitor (clicked the ad-pack email on
// a different device, zero Supabase session at all) has the `anon`
// Postgres role and would silently get nothing back. This function uses
// service-role access to expose only this one value, not the whole table
// (which also holds partner/pricing config not meant to be fully public).
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

    const url = (data?.value as any)?.url;

    return new Response(JSON.stringify({ url: typeof url === "string" ? url : null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-vsl-video] error", err);
    return new Response(JSON.stringify({ url: null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
