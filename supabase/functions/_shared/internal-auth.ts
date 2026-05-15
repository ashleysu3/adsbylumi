// Shared auth helpers for edge functions.

import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Returns true if the request is from a trusted internal caller (service role key).
 */
export function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return !!serviceKey && token === serviceKey;
}

/**
 * Verifies the request's Authorization header contains a valid user JWT.
 * Returns { userId } on success, or null on failure.
 */
export async function getAuthenticatedUser(
  req: Request
): Promise<{ userId: string; email?: string } | null> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  try {
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return { userId: data.claims.sub as string, email: data.claims.email as string | undefined };
  } catch {
    return null;
  }
}
