// Single source of truth for the user-facing app URL used in every email,
// redirect, and outbound link. Always returns a clean origin without a
// trailing slash. Honors PUBLIC_APP_URL first, then legacy SITE_URL, and
// falls back to the production custom domain so we never accidentally leak
// a Lovable preview/staging URL into a user's inbox.
const FALLBACK = "https://adsbylumi.com";

function clean(u: string | undefined | null): string | null {
  if (!u) return null;
  const trimmed = u.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  // Reject obvious preview/staging origins so a misconfigured env var can't
  // poison email links.
  if (/(\.lovable\.app|\.lovable\.dev|id-preview)/i.test(trimmed)) return null;
  return trimmed;
}

export function getPublicAppUrl(): string {
  return (
    clean(Deno.env.get("PUBLIC_APP_URL")) ||
    clean(Deno.env.get("SITE_URL")) ||
    FALLBACK
  );
}

export function appUrl(path = "/"): string {
  const base = getPublicAppUrl();
  if (!path) return base;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
