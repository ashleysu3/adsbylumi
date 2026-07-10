// Deletes abandoned anonymous auth users:
// - anonymous (is_anonymous = true / no email)
// - created more than 7 days ago
// - no brand rows linked
// Runs via a daily cron using the service-role key from vault.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isServiceRoleRequest } from "../_shared/internal-auth.ts";

const ABANDONED_AFTER_DAYS = 7;
const BATCH_SIZE = 200;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - ABANDONED_AFTER_DAYS * 24 * 60 * 60 * 1000);
  let deleted = 0;
  let scanned = 0;
  let page = 1;
  const errors: string[] = [];

  try {
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: BATCH_SIZE });
      if (error) throw error;
      const users = data?.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        scanned++;
        const isAnon = (u as any).is_anonymous === true || (!u.email && !u.phone);
        if (!isAnon) continue;
        if (new Date(u.created_at) > cutoff) continue;

        // Skip if the user owns any brand
        const { count: brandCount, error: brandErr } = await admin
          .from("brands")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.id);
        if (brandErr) {
          errors.push(`brand check ${u.id}: ${brandErr.message}`);
          continue;
        }
        if ((brandCount ?? 0) > 0) continue;

        const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
        if (delErr) {
          errors.push(`delete ${u.id}: ${delErr.message}`);
          continue;
        }
        deleted++;
      }

      if (users.length < BATCH_SIZE) break;
      page++;
      if (page > 100) break; // safety
    }

    console.log(`cleanup-abandoned-sessions: scanned=${scanned} deleted=${deleted} errors=${errors.length}`);
    return new Response(
      JSON.stringify({ success: true, scanned, deleted, errors }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("cleanup-abandoned-sessions error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e), scanned, deleted, errors }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
