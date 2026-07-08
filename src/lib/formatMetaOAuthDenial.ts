// Meta redirects back with `error` (a stable OAuth code) + `error_description`
// (Meta's own, sometimes-technical text) when a user cancels or the OAuth
// dialog itself fails, before any of our edge functions are ever called.
// This translates the stable `error` code — error_description varies too
// much to pattern-match reliably.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Looks like you didn't approve access on Meta's screen. Lumi needs those permissions to connect your ad account — try again when you're ready.",
  invalid_scope: "Meta rejected one of the permissions Lumi asked for. This is usually temporary — try connecting again.",
  redirect_uri_mismatch: "Meta rejected the connection because of a configuration mismatch. Please contact support if this keeps happening.",
  invalid_request: "Meta couldn't process the connection request. Please try again.",
};

export function formatMetaOAuthDenial(error: string, errorDescription?: string | null): string {
  return OAUTH_ERROR_MESSAGES[error] || errorDescription || "Meta connection didn't go through. Please try again.";
}
