// Shared CORS configuration for edge functions
// Uses origin allowlist for security instead of wildcard

const ALLOWED_ORIGINS = [
  // Production domains
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
  // If origin is allowed, reflect it back; otherwise use a safe default
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : 'https://youradassistant.app';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// Legacy wildcard headers for non-sensitive endpoints
export const corsHeadersWildcard = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
