// Translates Meta Graph API errors, account statuses, and permission scopes
// into plain English so users never see raw codes like "OAuthException" or
// "account_status: 2". Shared across every edge function that talks to the
// Meta Graph API, so a given failure reads the same way everywhere it shows up.

export interface MetaApiError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
}

// error.code (+ error_subcode where it narrows things down) -> plain English.
// Codes are Meta's own documented values; subcodes mostly live under 190
// (bad/expired token) and distinguish *why* the token stopped working.
const CODE_MESSAGES: Record<number, string> = {
  190: "Your Meta connection has expired or was revoked. Reconnect to get a fresh token.",
  102: "Your Meta session is no longer valid. Reconnect your account.",
  4: "Meta is rate-limiting requests from this app right now. Try again in a few minutes.",
  17: "You've hit Meta's request limit for now. Try again shortly.",
  32: "Meta is rate-limiting requests for this Page right now. Try again shortly.",
  10: "Meta didn't grant one of the permissions Lumi needs. Reconnect and approve all requested permissions.",
  200: "Meta blocked this because a required permission is missing. Reconnect and approve all requested permissions.",
  803: "That Meta object doesn't exist anymore — it may have been deleted or you lost access to it.",
  2500: "Your Meta session expired mid-request. Reconnect your account.",
};

const SUBCODE_MESSAGES: Record<number, string> = {
  458: "You haven't approved Lumi's access on Meta yet. Reconnect and approve the permissions screen.",
  459: "Your Meta session was invalidated (often after a password change). Reconnect your account.",
  460: "Your Meta session was invalidated. Reconnect your account.",
  463: "Your Meta access token expired. Reconnect your account.",
  464: "Meta needs you to confirm your account before Lumi can use it — check meta.com for a pending confirmation.",
  467: "That Meta access token isn't valid for this app. Reconnect your account.",
  490: "Meta logged you out (often after a password change). Reconnect your account.",
};

/**
 * Turn a raw Meta Graph API error object into a plain-English message.
 * Falls back to `fallback` (or a generic message) if the error doesn't
 * match a known code — never echoes Meta's raw `message`/`type` fields
 * back to the user.
 */
export function metaErrorMessage(err: MetaApiError | null | undefined, fallback?: string): string {
  if (!err) return fallback || "Something went wrong talking to Meta. Please try again.";
  if (err.error_subcode && SUBCODE_MESSAGES[err.error_subcode]) return SUBCODE_MESSAGES[err.error_subcode];
  if (err.code && CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code];
  return fallback || "Something went wrong talking to Meta. Please try again.";
}

// Ad account `account_status` -> plain English + whether it's something the
// user can act on themselves vs. needs to resolve directly with Meta.
const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: "Active",
  2: "Disabled by Meta — usually a billing or policy issue. Check Meta Ads Manager for details.",
  3: "Unsettled — there's an outstanding balance. Check billing in Meta Ads Manager.",
  7: "Under review by Meta. This usually resolves within a few days.",
  8: "Pending payment settlement. Check billing in Meta Ads Manager.",
  9: "In a grace period after a failed payment. Update your payment method in Meta Ads Manager.",
  100: "Pending closure.",
  101: "Closed. You'll need to select a different ad account.",
};

export function metaAccountStatusLabel(status: number): string {
  return ACCOUNT_STATUS_LABELS[status] || `In an unusual state (code ${status}) — check Meta Ads Manager for details.`;
}

// OAuth permission scope -> the plain-English name shown to users. Keep in
// sync with the scope list requested in meta-oauth-init.
const PERMISSION_LABELS: Record<string, string> = {
  ads_management: "Manage ads",
  ads_read: "Read ad performance",
  business_management: "Access your Meta Business account",
  pages_show_list: "See your Facebook Pages",
  pages_read_engagement: "Read Page engagement",
  instagram_basic: "Access your Instagram account",
};

export function metaPermissionLabel(scope: string): string {
  return PERMISSION_LABELS[scope] || scope;
}

export function metaPermissionLabels(scopes: string[]): string {
  return scopes.map(metaPermissionLabel).join(", ");
}
