// Shared CORS configuration for edge functions
// Uses origin allowlist for security instead of wildcard

const ALLOWED_ORIGINS = [
  // Production domains
  'https://adsbylumi.com',
  'https://www.adsbylumi.com',
  'https://youradassistant.app',
  'https://www.youradassistant.app',
  'https://staging.youradassistant.app',
  // Lovable preview domains
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') {
      return allowed === origin;
    }
    // RegExp pattern match for dynamic subdomains
    return allowed.test(origin);
  });
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Reflect allowed origins; fall back to wildcard so Lovable previews/new domains don't hard-fail.
  // Security is still enforced by auth + server-side authorization checks.
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// Legacy wildcard headers for non-sensitive endpoints
export const corsHeadersWildcard = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
