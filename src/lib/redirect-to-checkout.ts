// Stripe Checkout sets X-Frame-Options: DENY, so navigating an iframe
// (Lovable preview, embeds) to it silently fails and the user appears to
// bounce back to the page they were on. Always break out to the top window,
// falling back to a new tab when the frame is cross-origin.
export function redirectToCheckout(url: string): boolean {
  if (window.top === window.self) {
    window.location.href = url;
    return true;
  }
  try {
    window.top!.location.href = url;
    return true;
  } catch {
    window.open(url, "_blank", "noopener");
    return false;
  }
}
