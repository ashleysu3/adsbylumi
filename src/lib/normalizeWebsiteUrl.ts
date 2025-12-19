export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Common user input: "example.com" or "www.example.com"
  return `https://${trimmed.replace(/^\/+/, "")}`;
}
