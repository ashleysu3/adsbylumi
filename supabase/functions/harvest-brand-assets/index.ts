import { createClient } from "npm:@supabase/supabase-js@2";

const ENGINE_URL = Deno.env.get("ENGINE_URL") ?? "";
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function upgradeShowitUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.hostname !== "static.showit.co") return raw;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 4 || !/^\d+$/.test(parts[0])) return raw;
    parts[0] = "1600";
    parsed.pathname = `/${parts.join("/")}`;
    return parsed.toString();
  } catch {
    return raw;
  }
}

function showitAssetKey(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.hostname !== "static.showit.co") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    // Showit URL: /<requested-size>/<transform-id>/<site-id>/<filename>
    return parts.length >= 4 ? parts.slice(2).join("/") : null;
  } catch {
    return null;
  }
}

function storagePathFromUrl(raw: string): string | null {
  const match = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!SUPABASE_URL || !SERVICE || !ANON) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing Supabase env vars" }),
        { status: 200, headers: { ...cors, "content-type": "application/json" } },
      );
    }
    if (!ENGINE_URL) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing ENGINE_URL" }),
        { status: 200, headers: { ...cors, "content-type": "application/json" } },
      );
    }

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "not authenticated" }),
        { status: 200, headers: { ...cors, "content-type": "application/json" } },
      );
    }

    const { url, brandId } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "missing url" }),
        { status: 200, headers: { ...cors, "content-type": "application/json" } },
      );
    }
    if (!brandId || typeof brandId !== "string") {
      return new Response(
        JSON.stringify({ error: "missing brandId" }),
        { status: 200, headers: { ...cors, "content-type": "application/json" } },
      );
    }
    // Verify the calling user owns this brand
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: brandRow, error: brandErr } = await admin
      .from("brands")
      .select("id,user_id")
      .eq("id", brandId)
      .maybeSingle();
    if (brandErr || !brandRow || brandRow.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "brand not found or access denied" }),
        { status: 200, headers: { ...cors, "content-type": "application/json" } },
      );
    }


    const er = await fetch(`${ENGINE_URL.replace(/\/$/, "")}/extract-assets`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ENGINE_KEY },
      body: JSON.stringify({ url }),
    });
    if (!er.ok) {
      const txt = await er.text();
      return new Response(
        JSON.stringify({ error: `engine error ${er.status}: ${txt.slice(0, 300)}` }),
        { status: 200, headers: { ...cors, "content-type": "application/json" } },
      );
    }
    const data = await er.json();
    const assets = (data?.assets || []).slice(0, 40);
    const { data: currentAssets } = await admin
      .from("brand_assets")
      .select("id,url,source_url,width,height")
      .eq("brand_id", brandId);
    let saved = 0;
    let existing = 0;
    let skipped = 0;
    for (const a of assets) {
      try {
        if (!a?.url || typeof a.url !== "string") {
          skipped++;
          continue;
        }
        const sourceUrl = upgradeShowitUrl(a.url);
        const assetKey = showitAssetKey(a.url);
        const existingAsset = (currentAssets || []).find((row) =>
          row.source_url === a.url ||
          row.source_url === sourceUrl ||
          (assetKey && showitAssetKey(row.source_url || "") === assetKey)
        );
        const alreadyLarge = !!existingAsset &&
          (existingAsset.width || 0) >= 1080 &&
          (existingAsset.height || 0) >= 1080;
        if (alreadyLarge) {
          existing++;
          continue;
        }
        const resp = await fetch(sourceUrl);
        if (!resp.ok) {
          skipped++;
          continue;
        }
        const ct = resp.headers.get("content-type") || "image/jpeg";
        if (!ct.startsWith("image/")) {
          skipped++;
          continue;
        }
        const buf = new Uint8Array(await resp.arrayBuffer());
        if (buf.length > 8_000_000 || buf.length < 1000) {
          skipped++;
          continue;
        }
        const ext = ct.includes("png") ? "png" : ct.includes("svg") ? "svg" : ct.includes("webp") ? "webp" : "jpg";
        const existingPath = existingAsset ? storagePathFromUrl(existingAsset.url) : null;
        const filename = existingPath || `${user.id}/${brandId}/${crypto.randomUUID()}.${ext}`;
        const up = await admin.storage.from("brand-assets").upload(filename, buf, {
          contentType: ct,
          upsert: !!existingPath,
        });
        if (up.error) {
          skipped++;
          continue;
        }
        const { data: pub } = admin.storage.from("brand-assets").getPublicUrl(filename);
        const dimensions = sourceUrl !== a.url && a.width && a.height
          ? {
              width: 1600,
              height: Math.max(1, Math.round((a.height / a.width) * 1600)),
            }
          : { width: a.width, height: a.height };
        const payload = {
          user_id: user.id,
          brand_id: brandId,
          url: pub.publicUrl,
          source_url: sourceUrl,
          role: a.roleGuess,
          ...dimensions,
        };
        const { error: insertError } = existingAsset
          ? await admin.from("brand_assets").update(payload).eq("id", existingAsset.id)
          : await admin.from("brand_assets").insert(payload);
        if (insertError) {
          await admin.storage.from("brand-assets").remove([filename]);
          skipped++;
          continue;
        }
        saved++;
      } catch (_) {
        skipped++;
        /* skip bad asset */
      }
    }
    return new Response(
      JSON.stringify({ saved, existing, skipped, found: assets.length }),
      { status: 200, headers: { ...cors, "content-type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 200, headers: { ...cors, "content-type": "application/json" } },
    );
  }
});
