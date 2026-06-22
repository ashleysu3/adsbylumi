// Generates on-brand ad visuals from a board's Recraft style.
// Returns stored (signed) URLs in our own bucket so we own the assets.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RECRAFT_BASE = "https://external.api.recraft.ai/v1";

interface GenInput {
  boardId: string;
  brandId?: string;
  copy?: { headline?: string; subhead?: string; cta?: string };
  count?: number;
}

async function ensureStyle(
  admin: any,
  userAuthHeader: string,
  boardId: string,
  existingStyleId: string | null,
): Promise<string> {
  if (existingStyleId) return existingStyleId;
  const r = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/recraft-style-from-board`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: userAuthHeader,
      },
      body: JSON.stringify({ boardId }),
    },
  );
  const j = await r.json();
  if (!j?.success || !j?.style_id) {
    throw new Error(j?.error || "Could not build Recraft style");
  }
  return j.style_id as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RECRAFT_API_KEY = Deno.env.get("RECRAFT_API_KEY");
    if (!RECRAFT_API_KEY) throw new Error("RECRAFT_API_KEY not configured");

    const body = (await req.json()) as GenInput;
    const { boardId, brandId, copy, count } = body;
    if (!boardId) throw new Error("boardId required");
    const n = Math.min(Math.max(count ?? 4, 1), 6);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: board } = await admin
      .from("boards")
      .select("id, user_id, name, recraft_style_id")
      .eq("id", boardId)
      .maybeSingle();
    if (!board || board.user_id !== user.id) throw new Error("Board not found");

    const styleId = await ensureStyle(admin, authHeader, boardId, board.recraft_style_id);

    // Brand colors + name for the prompt.
    let brandName = "the brand";
    let colors: string[] = [];
    if (brandId) {
      const { data: brand } = await admin
        .from("brands")
        .select("name")
        .eq("id", brandId)
        .maybeSingle();
      if (brand?.name) brandName = brand.name;
      const { data: kit } = await admin
        .from("brand_kits")
        .select("colors")
        .eq("brand_id", brandId)
        .maybeSingle();
      const rawColors = (kit?.colors as any) || [];
      if (Array.isArray(rawColors)) {
        colors = rawColors
          .map((c: any) => (typeof c === "string" ? c : c?.hex || c?.value))
          .filter(Boolean)
          .slice(0, 5);
      } else if (rawColors && typeof rawColors === "object") {
        colors = Object.values(rawColors)
          .map((c: any) => (typeof c === "string" ? c : c?.hex || c?.value))
          .filter(Boolean)
          .slice(0, 5);
      }
    }

    const palette = colors.length ? `Brand color palette: ${colors.join(", ")}.` : "";
    const offerHint = [copy?.headline, copy?.subhead].filter(Boolean).join(" — ");

    const prompt = [
      `An on-brand Meta ad VISUAL/background for ${brandName}.`,
      offerHint ? `Offer context: ${offerHint}.` : "",
      palette,
      `Composition must leave generous CLEAN, UNCLUTTERED space (top-third and bottom-third) for overlay text. Do NOT bake in any words, letters, logos, headlines, captions, or CTAs — text will be overlaid separately.`,
      `Match the aesthetic, mood, and color world of the reference style. Premium, scroll-stopping, creator-friendly editorial feel.`,
    ].filter(Boolean).join(" ");

    const sizes: Array<{ label: "1x1" | "4x5"; size: string }> = [
      { label: "1x1", size: "1024x1024" },
      { label: "4x5", size: "1024x1280" },
    ];

    const generated: Array<{ aspect: string; recraftUrl: string }> = [];
    for (const s of sizes) {
      const res = await fetch(`${RECRAFT_BASE}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RECRAFT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          style_id: styleId,
          model: "recraftv3",
          n,
          size: s.size,
          response_format: "url",
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error("recraft /images/generations failed", res.status, text);
        return new Response(
          JSON.stringify({ success: false, error: `Recraft generate error: ${text}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const json = JSON.parse(text);
      for (const it of json?.data || []) {
        if (it?.url) generated.push({ aspect: s.label, recraftUrl: it.url });
      }
    }

    // Download + store in our bucket; return signed URLs.
    const stored: Array<{ aspect: string; url: string; path: string }> = [];
    for (const g of generated) {
      try {
        const imgRes = await fetch(g.recraftUrl);
        if (!imgRes.ok) continue;
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        const path = `${user.id}/${boardId}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await admin.storage
          .from("recraft-creatives")
          .upload(path, bytes, { contentType: "image/png", upsert: false });
        if (upErr) {
          console.warn("upload failed", upErr);
          continue;
        }
        const { data: signed } = await admin.storage
          .from("recraft-creatives")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) {
          stored.push({ aspect: g.aspect, url: signed.signedUrl, path });
        }
      } catch (e) {
        console.warn("download/store failed", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, style_id: styleId, images: stored }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("generate-ad-from-style error", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
