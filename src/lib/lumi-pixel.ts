// Funnel events for LUMI's OWN marketing pixel (loaded in index.html).
// Entirely separate from the customer-facing pixel features, which
// operate on customers' pixels — these exist so LUMI's own conversion
// campaigns have events to optimize against and retarget from, instead
// of the PageView-only signal the site sent before.

const STANDARD_EVENTS = new Set([
  "Lead",
  "InitiateCheckout",
  "Subscribe",
  "Purchase",
  "PageView",
]);

export function trackLumiEvent(event: string, params?: Record<string, unknown>) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq !== "function") return;
    fbq(STANDARD_EVENTS.has(event) ? "track" : "trackCustom", event, params);
  } catch {
    /* analytics must never break the app */
  }
}

// Fire once per key per browser session — for events on pages the user
// can refresh or revisit (e.g. Subscribe on the checkout-return page).
export function trackLumiEventOnce(
  key: string,
  event: string,
  params?: Record<string, unknown>,
) {
  try {
    const storageKey = `lumi_pixel_${key}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    /* storage unavailable — fall through and still track */
  }
  trackLumiEvent(event, params);
}
