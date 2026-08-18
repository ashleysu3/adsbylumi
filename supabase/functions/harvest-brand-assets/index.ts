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

function isShowitThumbnail(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    const requested = parsed.pathname.split("/").filter(Boolean)[0];
    return parsed.hostname === "static.showit.co" && /^\d+$/.test(requested) && Number(requested) < 1080;
  } catch {
    return false;
  }
}

function storagePathFromUrl(raw: string): string | null {
  const match = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function imageDimensions(buf: Uint8Array, contentType: string): { width: number; height: number } | null {
  // PNG stores width/height as big-endian uint32 values in the IHDR chunk.
  if (contentType.includes("png") && buf.length >= 24) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // Walk JPEG markers until a Start Of Frame marker supplies dimensions.
  if ((contentType.includes("jpeg") || contentType.includes("jpg")) && buf.length >= 4) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) { offset++; continue; }
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = (buf[offset + 2] << 8) + buf[offset + 3];
      if (length < 2 || offset + length + 2 > buf.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: (buf[offset + 5] << 8) + buf[offset + 6],
          width: (buf[offset + 7] << 8) + buf[offset + 8],
        };
      }
      offset += length + 2;
    }
  }
  return null;
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

    const { url, brandId, repairExisting = false, repairOffset = 0 } = await req.json();
    if ((!url || typeof url !== "string") && !repairExisting) {
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


    const { data: currentAssets } = await admin
      .from("brand_assets")
      .select("id,url,source_url,width,height,role")
      .eq("brand_id", brandId);
    let assets: Array<{ url: string; roleGuess?: string; width?: number; height?: number }>;
    if (repairExisting) {
      assets = (currentAssets || [])
        .filter((row) =>
          row.role === "photo" &&
          !!row.source_url &&
          isShowitThumbnail(row.source_url)
        )
        .slice(Math.max(0, Number(repairOffset) || 0), Math.max(0, Number(repairOffset) || 0) + 12)
        .map((row) => ({
          url: row.source_url,
          width: row.width,
          height: row.height,
        }));
    } else {
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
      assets = (data?.assets || []).slice(0, 40);
    }
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
        const dimensions = imageDimensions(buf, ct) || { width: a.width, height: a.height };
        const payload = {
          user_id: user.id,
          brand_id: brandId,
          url: pub.publicUrl,
          source_url: sourceUrl,
          ...(a.roleGuess ? { role: a.roleGuess } : {}),
          ...dimensions,
        };
        const { error: insertError } = existingAsset
          ? await admin.from("brand_assets").update(payload).eq("id", existingAsset.id)
          : await admin.from("brand_assets").insert(payload);
        if (insertError) {
          if (!existingAsset) await admin.storage.from("brand-assets").remove([filename]);
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
