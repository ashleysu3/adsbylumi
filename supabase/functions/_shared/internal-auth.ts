// Shared auth helpers for edge functions.

import { createClient } from "npm:@supabase/supabase-js@2";

export function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return !!serviceKey && token === serviceKey;
}

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
    return {
      userId: data.claims.sub as string,
      email: data.claims.email as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Allow either internal service-role calls OR an authenticated end user.
 * Returns true if the caller is authorized.
 */
export async function isInternalOrAuthenticated(req: Request): Promise<boolean> {
  if (isServiceRoleRequest(req)) return true;
  const user = await getAuthenticatedUser(req);
  return !!user;
}
