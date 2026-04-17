export function normalizeWebsiteUrl(input: string): string {
  let trimmed = input.trim();
  if (!trimmed) return "";

  // Strip whitespace and zero-width characters that sometimes get pasted in
  trimmed = trimmed.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // If a scheme is present, normalize it: collapse extra slashes after `://`
  // (e.g. "https:///www.example.com" → "https://www.example.com")
  const schemeMatch = trimmed.match(/^(https?:)\/*(.*)$/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    const rest = schemeMatch[2].replace(/^\/+/, "");
    return `${scheme}//${rest}`;
  }

  // No scheme: strip any stray leading slashes and prepend https://
  return `https://${trimmed.replace(/^\/+/, "")}`;
}
