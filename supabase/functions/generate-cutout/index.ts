// Produce a background-removed cutout for a user_assets row ONCE and store it.
//
// Until now nothing ever wrote user_assets.cutout_url — the column existed and
// was already READ (the creative photo picker prefers `cutout_url || original_url`),
// but background removal was redone inside the engine on every single /render
// that used a cutout template, re-paying the provider for the same photo.
//
// The engine's /render already accepts a pre-made cutout and passes it straight
// through, so once this fills cutout_url the provider call is skipped on every
// later render of that photo.
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthedUser } from "../_shared/check-subscription.ts";

const ENGINE_URL = Deno.env.get("ENGINE_URL") ?? "";
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  const headers = { ...cors, "content-type": "application/json" };
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const gate = await requireAuthedUser(req, headers);
    if (gate.blocked) return gate.blocked;
    const userId = gate.userId!;

    const { assetId, force = false } = await req.json().catch(() => ({}));
    if (!assetId) return json({ error: "assetId required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: asset, error: loadErr } = await admin
      .from("user_assets")
      .select("id, user_id, original_url, cutout_url")
      .eq("id", assetId)
      .maybeSingle();
    if (loadErr) return json({ error: loadErr.message }, 500);
    if (!asset) return json({ error: "asset not found" }, 404);
    // The service-role client bypasses RLS, so ownership has to be checked here.
    if (asset.user_id !== userId) return json({ error: "forbidden" }, 403);
    if (!asset.original_url) return json({ error: "asset has no original_url" }, 400);

    // Idempotent by design — never re-pay the provider for a cutout we already have.
    if (asset.cutout_url && !force) {
      return json({ cutout_url: asset.cutout_url, cached: true });
    }

    // original_url is stored inconsistently in the wild: the onboarding uploader
    // writes a full public URL (getPublicUrl), while the creative photo picker
    // treats the same column as a bare storage path (createSignedUrls). Normalize
    // both shapes to a fetchable URL rather than assuming either one.
    const raw = asset.original_url as string;
    let sourceUrl = raw;
    const marker = "/ad-photos/";
    const storagePath = raw.startsWith("http")
      ? (raw.includes(marker) ? decodeURIComponent(raw.split(marker)[1].split("?")[0]) : null)
      : raw;
    if (storagePath) {
      // ad-photos is private, so a stored public URL would 404 — always re-sign.
      const { data: signed, error: signErr } = await admin.storage
        .from("ad-photos")
        .createSignedUrl(storagePath, 60 * 10);
      if (signErr || !signed?.signedUrl) {
        return json({ error: `could not sign source image: ${signErr?.message || "unknown"}` }, 500);
      }
      sourceUrl = signed.signedUrl;
    }

    const engineRes = await fetch(`${ENGINE_URL}/cutout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(ENGINE_KEY ? { "x-api-key": ENGINE_KEY } : {}),
      },
      body: JSON.stringify({ url: sourceUrl }),
    });
    const engineBody = await engineRes.json().catch(() => null);
    if (!engineRes.ok || !engineBody?.base64) {
      return json(
        { error: `cutout failed: ${engineBody?.error || `engine ${engineRes.status}`}` },
        502,
      );
    }

    const bytes = Uint8Array.from(atob(engineBody.base64), (c) => c.charCodeAt(0));
    // Deterministic path per asset so a re-run overwrites rather than piling up.
    const path = `cutouts/${assetId}.png`;
    const { error: upErr } = await admin.storage.from("ad-photos").upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "3600",
    });
    if (upErr) return json({ error: `could not store cutout: ${upErr.message}` }, 500);

    const { error: updErr } = await admin
      .from("user_assets")
      .update({ cutout_url: path })
      .eq("id", assetId);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ cutout_url: path, provider: engineBody.provider, ms: engineBody.ms });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
