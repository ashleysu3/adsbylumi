type MaybeContext = {
  status?: number;
  statusText?: string;
  body?: string;
};

/**
 * Extract a human-readable error message from a Supabase functions.invoke error.
 * The SDK wraps non-2xx responses in an object with `context.body` containing
 * the actual JSON response from the edge function.
 */
export function formatInvokeError(error: any): string {
  const context: MaybeContext | undefined = error?.context;

  const status = typeof context?.status === "number" ? context.status : null;

  // Try to parse the response body first — this has the real error from our edge function
  const bodyText = typeof context?.body === "string" ? context.body : "";
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const inner = parsed?.error ?? parsed?.message;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    } catch {
      // ignore
    }
    if (bodyText.trim() && !bodyText.includes("non-2xx")) return bodyText.trim();
  }

  // Fall back to error.message, but filter out the unhelpful SDK wrapper message
  const msg = error?.message || error?.details || error?.hint;
  const msgStr = typeof msg === "string" ? msg.trim() : "";

  // If the message is just the generic SDK wrapper, provide a better fallback
  if (!msgStr || msgStr.includes("non-2xx status code") || msgStr.includes("Edge Function returned")) {
    if (status === 504 || status === 502) {
      return "The request timed out. Please try again.";
    }
    if (status === 500) {
      return "Something went wrong on our end. Please try again in a moment.";
    }
    if (status) {
      return `Request failed (${status}). Please try again.`;
    }
    return "Something went wrong. Please try again.";
  }

  return msgStr;
}
