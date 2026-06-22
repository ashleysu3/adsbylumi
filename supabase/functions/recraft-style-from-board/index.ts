// Creates a Recraft style from up to 5 reference images on a board.
// Accepts an optional explicit selection (selectedImageUrls) — when provided,
// uses exactly those images instead of auto-picking the 5 most recent.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RECRAFT_BASE = "https://external.api.recraft.ai/v1";

async function fetchAsPng(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return new Blob([buf], { type: "image/png" });
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RECRAFT_API_KEY = Deno.env.get("RECRAFT_API_KEY");
    if (!RECRAFT_API_KEY) throw new Error("RECRAFT_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const boardId: string | undefined = body?.boardId;
    const selectedImageUrls: string[] | undefined = Array.isArray(body?.selectedImageUrls)
      ? body.selectedImageUrls.slice(0, 5)
      : undefined;
    const selectedItemIds: string[] | undefined = Array.isArray(body?.selectedItemIds)
      ? body.selectedItemIds.slice(0, 5)
      : undefined;
    const cacheOnBoard: boolean = body?.cacheOnBoard !== false && !selectedImageUrls && !selectedItemIds;
    if (!boardId) throw new Error("boardId required");

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

    const { data: board, error: bErr } = await admin
      .from("boards")
      .select("id, user_id")
      .eq("id", boardId)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!board || board.user_id !== user.id) throw new Error("Board not found");

    // Resolve URLs to fetch.
    let urls: string[] = [];

    if (selectedImageUrls && selectedImageUrls.length > 0) {
      urls = selectedImageUrls.filter(Boolean).slice(0, 5);
    } else {
      let query = admin
        .from("board_items")
        .select("id, uploaded_image_url, inspiration_items(image_url)")
        .eq("board_id", boardId);
      if (selectedItemIds && selectedItemIds.length > 0) {
        query = query.in("id", selectedItemIds);
      } else {
        query = query.order("created_at", { ascending: false }).limit(5);
      }
      const { data: items, error: iErr } = await query;
      if (iErr) throw iErr;

      for (const it of items || []) {
        const insp = (it as any).inspiration_items?.image_url as string | undefined;
        const up = (it as any).uploaded_image_url as string | undefined;
        const raw = up || insp;
        if (!raw) continue;
        if (raw.startsWith("http")) {
          urls.push(raw);
        } else {
          const { data: signed } = await admin.storage
            .from("inspiration")
            .createSignedUrl(raw, 60 * 5);
          if (signed?.signedUrl) urls.push(signed.signedUrl);
        }
        if (urls.length >= 5) break;
      }
    }

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No usable images for this style" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const form = new FormData();
    form.append("style", "digital_illustration");
    for (const u of urls) {
      const blob = await fetchAsPng(u);
      if (blob) form.append("files", blob, `ref-${crypto.randomUUID()}.png`);
    }

    const styleRes = await fetch(`${RECRAFT_BASE}/styles`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RECRAFT_API_KEY}` },
      body: form,
    });
    const styleText = await styleRes.text();
    if (!styleRes.ok) {
      console.error("recraft /styles failed", styleRes.status, styleText);
      return new Response(
        JSON.stringify({ success: false, error: `Recraft styles error: ${styleText}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const styleJson = JSON.parse(styleText);
    const styleId = styleJson.id || styleJson.style_id;
    if (!styleId) throw new Error("Recraft did not return a style id");

    if (cacheOnBoard) {
      await admin
        .from("boards")
        .update({ recraft_style_id: styleId, recraft_style_updated_at: new Date().toISOString() })
        .eq("id", boardId)
        .select()
        .single();
    }

    return new Response(
      JSON.stringify({ success: true, style_id: styleId, reference_count: urls.length, cached: cacheOnBoard }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("recraft-style-from-board error", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
