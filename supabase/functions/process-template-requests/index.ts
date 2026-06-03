import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENGINE_URL = Deno.env.get("ENGINE_URL")!;
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY")!;
const SAMPLE_PHOTO_URL =
  "https://sqwjbndgighjtifijgws.supabase.co/storage/v1/object/public/email-assets/sample-headshot.png";

const MAX_BATCH = 3;
const MAX_ATTEMPTS = 3;
const LOCK_STALE_MIN = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    // Reset stale building rows (lock older than LOCK_STALE_MIN minutes)
    await admin
      .from("template_requests")
      .update({ status: "pending", locked_at: null })
      .eq("status", "building")
      .lt("locked_at", new Date(Date.now() - LOCK_STALE_MIN * 60_000).toISOString());

    // Claim a small batch of pending rows
    const { data: pending, error: pErr } = await admin
      .from("template_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);
    if (pErr) throw pErr;

    const claimed: any[] = [];
    for (const row of pending || []) {
      const { data: upd } = await admin
        .from("template_requests")
        .update({ status: "building", locked_at: new Date().toISOString(), attempts: (row.attempts || 0) + 1 })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      if (upd) claimed.push(upd);
    }

    const results: any[] = [];
    for (const row of claimed) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90_000);
        const r = await fetch(`${ENGINE_URL}/build-template`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": ENGINE_KEY },
          body: JSON.stringify({
            imageUrl: row.reference_url,
            notes: row.notes || "",
            samplePhotoUrl: SAMPLE_PHOTO_URL,
            tries: 3,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const body = await r.json().catch(() => ({}));

        if (!r.ok || body?.error) {
          const errMsg = body?.error || `engine ${r.status}`;
          const giveUp = (row.attempts || 0) >= MAX_ATTEMPTS;
          await admin
            .from("template_requests")
            .update({
              status: giveUp ? "failed" : "pending",
              error: errMsg,
              locked_at: null,
              result: body || null,
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, error: errMsg });
          continue;
        }

        // Success — create draft template if engine flagged ok
        let templateId: string | null = null;
        if (body?.ok && typeof body?.html === "string" && body.html) {
          const { data: ins } = await admin
            .from("templates")
            .insert({
              name: body.name || "Untitled template",
              type: body.type === "carousel" ? "carousel" : "single",
              html: body.html,
              copy_slots: body.copySlots || [],
              slide_slots: body.slideSlots || [],
              needs_photo: body.needsPhoto ?? true,
              style_hint: body.styleHint || null,
              source_image_url: row.source_path || row.reference_url,
              status: "draft",
            })
            .select("id")
            .maybeSingle();
          templateId = ins?.id || null;
        }

        await admin
          .from("template_requests")
          .update({
            status: body?.ok ? "ready" : "failed",
            error: body?.ok ? null : (body?.errors || []).join("; ") || "validation_failed",
            result: { ...body, template_id: templateId },
            locked_at: null,
          })
          .eq("id", row.id);

        results.push({ id: row.id, ok: !!body?.ok, template_id: templateId });
      } catch (e: any) {
        const giveUp = (row.attempts || 0) >= MAX_ATTEMPTS;
        await admin
          .from("template_requests")
          .update({
            status: giveUp ? "failed" : "pending",
            error: e?.message || String(e),
            locked_at: null,
          })
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  }
});
