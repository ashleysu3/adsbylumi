// deno-lint-ignore-file no-explicit-any
// Daily sweep: deletes anonymous auth.users older than the grace window
// who never captured an email (via the ad-pack lead magnet). Email
// capture is the "keep this session" signal — see brands.lead_email,
// added in the lead-magnet-funnel migrations. brands.user_id has
// ON DELETE CASCADE to auth.users, so deleting the user also cleans up
// their brand row and anything that cascades from it.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isServiceRoleRequest } from "../_shared/internal-auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const GRACE_DAYS = 7;
const MAX_USERS_PER_RUN = 2000; // safety cap; catches up over subsequent daily runs if ever exceeded

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Cron-only — this deletes accounts, never expose it to end users.
  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Protected set: anyone who captured a lead email keeps their session,
    // regardless of age.
    const { data: protectedBrands, error: brandsErr } = await supabaseAdmin
      .from("brands")
      .select("user_id")
      .not("lead_email", "is", null);
    if (brandsErr) throw brandsErr;
    const protectedIds = new Set((protectedBrands || []).map((b: any) => b.user_id));

    let checked = 0;
    let deleted = 0;
    const errors: string[] = [];
    let page = 1;
    const perPage = 200;

    while (checked < MAX_USERS_PER_RUN) {
      const { data: listRes, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listErr) throw listErr;
      const users = listRes?.users || [];
      if (!users.length) break;

      for (const u of users) {
        checked++;
        const isAnon = !!(u as any).is_anonymous;
        if (!isAnon) continue;
        if (protectedIds.has(u.id)) continue;
        if (!u.created_at || u.created_at > cutoff) continue;

        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        if (delErr) {
          errors.push(`${u.id}: ${delErr.message}`);
        } else {
          deleted++;
        }
      }

      if (users.length < perPage) break; // last page
      page++;
    }

    console.log(`[cleanup-abandoned-sessions] checked=${checked} deleted=${deleted} errors=${errors.length}`);

    return new Response(JSON.stringify({ checked, deleted, errors }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cleanup-abandoned-sessions] error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
