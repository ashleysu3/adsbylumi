// Shared Firecrawl scrapers. Extracted from analyze-brand-voice so every
// psychology/voice generator can pull the same sources — especially the
// Instagram captions that were previously collected at onboarding and then
// dropped on the floor.

export async function firecrawlScrape(url: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const data = await res.json().catch(() => null);
    const md: string | undefined = data?.data?.markdown || data?.markdown;
    return md && md.length > 50 ? md.slice(0, 8000) : "";
  } catch {
    return "";
  }
}

export async function fetchInstagramCaptions(handle: string, apiKey: string): Promise<string> {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `https://www.instagram.com/${clean}/`,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    const data = await res.json().catch(() => null);
    const md: string | undefined = data?.data?.markdown || data?.markdown;
    return md && md.length > 20 ? md.slice(0, 5000) : "";
  } catch {
    return "";
  }
}
