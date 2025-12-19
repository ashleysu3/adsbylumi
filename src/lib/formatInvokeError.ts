type MaybeContext = {
  status?: number;
  statusText?: string;
  body?: string;
};

export function formatInvokeError(error: any): string {
  const context: MaybeContext | undefined = error?.context;

  const statusPrefix = typeof context?.status === "number" ? `[${context.status}] ` : "";

  const bodyText = typeof context?.body === "string" ? context.body : "";
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const inner = parsed?.error ?? parsed?.message;
      if (typeof inner === "string" && inner.trim()) return `${statusPrefix}${inner.trim()}`;
    } catch {
      // ignore
    }
    if (bodyText.trim()) return `${statusPrefix}${bodyText.trim()}`;
  }

  const msg = error?.message || error?.details || error?.hint;
  return `${statusPrefix}${typeof msg === "string" && msg.trim() ? msg.trim() : "Unknown error"}`;
}
