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
  boardId?: string;
  brandId?: string;
  copy?: { headline?: string; subhead?: string; cta?: string };
  count?: number;
  selectedImageUrls?: string[];
  selectedItemIds?: string[];
  // Beta: composite mode — generate a clean BACKGROUND (no people, no text)
  // styled from the brand's approved background/texture assets. The caller
  // composites the headshot + copy + logo over the result.
  mode?: "board" | "brand_background";
}

async function buildStyle(
  userAuthHeader: string,
  opts: {
    boardId?: string;
    brandId?: string;
    existingStyleId?: string | null;
    selectedImageUrls?: string[];
    selectedItemIds?: string[];
  },
): Promise<string | null> {
  const { boardId, brandId, existingStyleId, selectedImageUrls, selectedItemIds } = opts;
  const hasSelection = (selectedImageUrls && selectedImageUrls.length > 0) ||
    (selectedItemIds && selectedItemIds.length > 0);
  // Reuse cached board style only when we have no explicit selection.
  if (boardId && existingStyleId && !hasSelection) return existingStyleId;
  // Brand-background mode with zero refs: skip style entirely; the generation
  // will fall back to a neutral on-brand prompt.
  if (!boardId && (!selectedImageUrls || selectedImageUrls.length === 0)) return null;

  const r = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/recraft-style-from-board`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: userAuthHeader,
      },
      body: JSON.stringify({
        boardId,
        brandId,
        selectedImageUrls,
        selectedItemIds,
        cacheOnBoard: !!boardId && !hasSelection,
      }),
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
    const { boardId, brandId, copy, count, selectedImageUrls, selectedItemIds } = body;
    const mode = body.mode || (boardId ? "board" : "brand_background");
    if (!boardId && !brandId) throw new Error("boardId or brandId required");
    if (mode === "brand_background" && !brandId) throw new Error("brandId required in brand_background mode");
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

    let existingStyleId: string | null = null;
    if (mode === "board") {
      const { data: board } = await admin
        .from("boards")
        .select("id, user_id, name, recraft_style_id")
        .eq("id", boardId!)
        .maybeSingle();
      if (!board || board.user_id !== user.id) throw new Error("Board not found");
      existingStyleId = (board as any).recraft_style_id || null;
    }

    // Brand colors + name (+ background/texture asset refs in brand mode).
    let brandName = "the brand";
    let colors: string[] = [];
    let brandRefUrls: string[] = [];
    if (brandId) {
      const { data: brand } = await admin
        .from("brands")
        .select("id, user_id, name")
        .eq("id", brandId)
        .maybeSingle();
      if (!brand) throw new Error("Brand not found");
      if (mode === "brand_background" && (brand as any).user_id !== user.id) {
        throw new Error("Brand not found");
      }
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

      if (mode === "brand_background") {
        const { data: assets } = await admin
          .from("brand_assets")
          .select("url, role, kept")
          .eq("brand_id", brandId)
          .eq("kept", true)
          .in("role", ["background", "texture"]);
        const rows = (assets || []) as Array<{ url: string; role: string }>;
        for (const row of rows) {
          if (!row?.url) continue;
          // brand_assets url may be a storage path or a full URL; sign storage paths
          const m = row.url.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
          if (m) {
            const { data: signed } = await admin.storage
              .from("brand-assets")
              .createSignedUrl(decodeURIComponent(m[1]), 60 * 10);
            if (signed?.signedUrl) brandRefUrls.push(signed.signedUrl);
          } else if (row.url.startsWith("http")) {
            brandRefUrls.push(row.url);
          }
          if (brandRefUrls.length >= 5) break;
        }
      }
    }

    // FALLBACK: if the brand has approved background/texture assets,
    // skip generation entirely (no model = no gibberish text, no invented
    // faces). Return those URLs directly as the "images" so the dialog can
    // composite them as the background layer.
    if (mode === "brand_background" && brandRefUrls.length > 0) {
      const stored = brandRefUrls.slice(0, 4).map((u, i) => ({
        aspect: i % 2 === 0 ? "1x1" : "4x5",
        url: u,
        path: `brand-asset:${i}`,
        source: "brand_asset" as const,
      }));
      return new Response(
        JSON.stringify({ success: true, style_id: null, images: stored, used_brand_assets: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const styleId = await buildStyle(authHeader, {
      boardId,
      brandId,
      existingStyleId,
      selectedImageUrls: mode === "brand_background" ? brandRefUrls : selectedImageUrls,
      selectedItemIds: mode === "board" ? selectedItemIds : undefined,
    });

    const palette = colors.length ? `Brand color palette: ${colors.join(", ")}.` : "";
    const offerHint = [copy?.headline, copy?.subhead].filter(Boolean).join(" — ");
    const noPeople = `ABSOLUTELY NO people, NO faces, NO human figures, NO hands, NO arms, NO body parts, NO portraits, NO characters, NO silhouettes of humans, NO mannequins, NO crowd, NO eyes, NO mouths.`;
    const noText = `ABSOLUTELY NO text, NO letters, NO words, NO numbers, NO typography, NO captions, NO headlines, NO labels, NO signs, NO writing of any kind, NO logos, NO watermarks, NO brand marks, NO CTAs, NO buttons. The image must be 100% text-free.`;
    const layoutSpace = `Leave the CENTER and LOWER area clean, empty, and uncluttered — no objects in the middle — so a text card and circular headshot can be overlaid on top.`;
    const sceneHint = mode === "brand_background"
      ? `Render ONLY one of: a soft abstract gradient, a subtle paper/fabric/wall texture, a calm tabletop flatlay with a few small props at the edges, a soft light-leak, or an empty editorial environment. ${brandRefUrls.length === 0 ? "Use a neutral, premium on-brand look built from the brand color palette." : "Match the aesthetic, mood, and color world of the brand reference textures/backgrounds."}`
      : `Match the aesthetic, mood, and color world of the reference style. Premium, scroll-stopping, creator-friendly editorial feel.`;

    const prompt = [
      `Plain on-brand BACKGROUND IMAGE for ${brandName} — background only, nothing else.`,
      offerHint ? `(Offer context for color/mood only — do NOT depict it: ${offerHint}.)` : "",
      palette,
      sceneHint,
      layoutSpace,
      noText,
      noPeople,
    ].filter(Boolean).join(" ");

    const negativePrompt = "text, letters, words, numbers, typography, captions, headlines, watermark, logo, signature, signs, writing, gibberish text, fake text, garbled letters, people, person, face, faces, portrait, hands, arms, body, human figure, silhouette of a person, character, mannequin, eyes, mouth, hair";

    const sizes: Array<{ label: "1x1" | "4x5"; size: string }> = [
      { label: "1x1", size: "1024x1024" },
      { label: "4x5", size: "1024x1280" },
    ];

    const generated: Array<{ aspect: string; recraftUrl: string }> = [];
    for (const s of sizes) {
      const genBody: Record<string, unknown> = {
        prompt,
        negative_prompt: negativePrompt,
        model: "recraftv3",
        n,
        size: s.size,
        response_format: "url",
      };
      if (styleId) genBody.style_id = styleId;
      const res = await fetch(`${RECRAFT_BASE}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RECRAFT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(genBody),
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
        const folder = boardId || `brand-${brandId}` || "misc";
        const path = `${user.id}/${folder}/${crypto.randomUUID()}.png`;
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
