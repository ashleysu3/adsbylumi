import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(payload: Record<string, unknown>, cors: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function isValidPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const h = url.hostname.toLowerCase();
    const blocked = [
      /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
      /^169\.254\./, /^0\./, /^localhost$/i, /\.local$/i, /^metadata/i, /\.internal$/i,
    ];
    if (blocked.some((p) => p.test(h))) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
    if (h.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchWebsiteText(websiteUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const html = await res.text();
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.slice(0, 8000);
  } catch {
    return "";
  }
}

async function firecrawlScrape(url: string, apiKey: string): Promise<string> {
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

async function fetchInstagramCaptions(handle: string, apiKey: string): Promise<string> {
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const brandId = typeof body?.brandId === "string" ? body.brandId : "";
    const instagramHandle =
      typeof body?.instagramHandle === "string" ? body.instagramHandle.trim() : "";
    if (!brandId) return json({ error: "brandId is required" }, cors, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not authenticated" }, cors, 200);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, cors, 200);

    // Verify user owns the brand
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Not authenticated" }, cors, 200);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: brand, error: brandErr } = await admin
      .from("brands")
      .select("id, user_id, name, website_url, brand_voice, voice_profile, value_proposition, target_audience")
      .eq("id", brandId)
      .maybeSingle();
    if (brandErr || !brand) return json({ error: "Brand not found" }, cors, 200);
    if (brand.user_id !== userData.user.id) return json({ error: "Forbidden" }, cors, 200);

    const websiteUrl = brand.website_url as string | null;
    let websiteText = "";
    if (websiteUrl && isValidPublicUrl(websiteUrl)) {
      websiteText = await fetchWebsiteText(websiteUrl);
      if ((!websiteText || websiteText.length < 200) && FIRECRAWL_API_KEY) {
        websiteText = await firecrawlScrape(websiteUrl, FIRECRAWL_API_KEY);
      }
    }

    // Also pull any offer sales pages so we capture testimonials, case studies,
    // and press features that live on a sales page rather than the homepage.
    let salesPagesText = "";
    try {
      const { data: offers } = await admin
        .from("offers")
        .select("name, url")
        .eq("brand_id", brandId)
        .limit(5);
      if (Array.isArray(offers)) {
        for (const o of offers) {
          const u = (o as any)?.url as string | undefined;
          if (!u || !isValidPublicUrl(u)) continue;
          if (websiteUrl && u === websiteUrl) continue;
          let txt = await fetchWebsiteText(u);
          if ((!txt || txt.length < 200) && FIRECRAWL_API_KEY) {
            txt = await firecrawlScrape(u, FIRECRAWL_API_KEY);
          }
          if (txt) {
            salesPagesText += `\n\n--- SALES PAGE: ${(o as any)?.name || u} (${u}) ---\n${txt}`;
          }
        }
        salesPagesText = salesPagesText.slice(0, 16000);
      }
    } catch (e) {
      console.error("sales page scrape failed", (e as any)?.message || e);
    }

    let igText = "";
    if (instagramHandle && FIRECRAWL_API_KEY) {
      igText = await fetchInstagramCaptions(instagramHandle, FIRECRAWL_API_KEY);
    }

    if (!websiteText && !igText && !salesPagesText) {
      return json(
        { error: "Couldn't read enough content from your website or Instagram to analyze your voice." },
        cors,
        200,
      );
    }

    const systemPrompt = `You are an expert brand voice strategist AND social proof analyst. Analyze the user's real writing (from their website, sales pages, and/or Instagram) and produce TWO things in one JSON object:

1) A STRUCTURED brand voice profile that captures HOW THEY ACTUALLY SOUND.
2) A SOCIAL PROOF inventory of every real piece of credibility found in the source (testimonials, case studies, press features, notable clients, stats, awards, credentials).

Return ONLY JSON matching this shape:
{
  "summary": "2-3 sentence plain-English description of how this brand sounds (use the same energy they use). This is what feeds ad generation as 'brand_voice'.",
  "tone_descriptors": ["3-6 short adjectives, e.g. 'warm', 'irreverent', 'no-nonsense', 'editorial', 'best-friend energy'"],
  "perspective": "first_person | first_person_plural | second_person | mixed",
  "formality": "casual | conversational | polished | formal",
  "sentence_rhythm": "short and punchy | mixed | flowing | long-form",
  "emoji_usage": "none | sparingly | often | signature",
  "signature_phrases": ["actual phrases or sentence starters they use repeatedly, lifted from the source"],
  "vocabulary_loves": ["specific words they reach for"],
  "vocabulary_avoids": ["words/phrases that would feel OFF for this brand (hype words they don't use, jargon, etc.)"],
  "example_sentences": ["3-5 short sentences written in their voice, suitable as style references for ad copy"],
  "do": ["3-5 concrete dos a copywriter should follow to sound like this brand"],
  "dont": ["3-5 concrete don'ts"],
  "social_proof": {
    "testimonials": [
      { "quote": "exact words from the source", "attribution": "name/role/handle if present, else null", "result": "specific outcome mentioned if any" }
    ],
    "case_studies": [
      { "client": "who", "before": "starting situation", "after": "result/transformation", "details": "any specifics like timeframe or numbers" }
    ],
    "press_features": [
      { "outlet": "publication or podcast or stage name", "context": "what it was (interview, feature, speaker, etc.) if mentioned" }
    ],
    "notable_clients": ["brands, companies, or recognizable names they've worked with"],
    "credentials": ["certifications, degrees, years of experience, titles"],
    "stats": ["concrete numeric proof, e.g. '$2M+ generated for clients', '10,000 students', '4.9★ rating'"],
    "awards": ["awards, rankings, bestseller status"]
  }
}

Hard rules:
- Ground every field in the source text. Quote real phrases when possible.
- Do not invent a tone, testimonial, press feature, or stat that isn't in the source. If a category has nothing, return an empty array.
- Pull the strongest 3-10 testimonials when many exist. Preserve the client's actual wording verbatim.
- Keep arrays tight — quality over quantity.
- No markdown, no commentary, JSON only.`;

    const userPrompt = `BRAND: ${brand.name}
${brand.value_proposition ? `VALUE PROP: ${brand.value_proposition}` : ""}
${brand.target_audience ? `AUDIENCE: ${brand.target_audience}` : ""}

=== WEBSITE COPY ===
${websiteText || "(not available)"}

=== SALES PAGE COPY ===
${salesPagesText || "(not available)"}

=== INSTAGRAM COPY ===
${igText || "(not available)"}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t.slice(0, 300));
      return json({ error: `Voice analysis failed (${aiRes.status})` }, cors, 200);
    }

    const aiData = await aiRes.json();
    const content: string =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.choices?.[0]?.text ??
      "";

    const extractJson = (text: string) => {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? text).trim();
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      const candidate = first !== -1 && last !== -1 ? raw.slice(first, last + 1) : raw;
      return JSON.parse(candidate);
    };

    let profile: any;
    try {
      profile = extractJson(content);
    } catch (e) {
      console.error("Parse error", e, content?.slice(0, 200));
      return json({ error: "Couldn't parse voice profile" }, cors, 200);
    }

    // Split out social_proof so it lives in its own column and the voice_profile
    // stays focused on tone/style.
    const socialProof = profile && typeof profile === "object" ? profile.social_proof ?? null : null;
    const voiceOnly = profile && typeof profile === "object" ? { ...profile } : profile;
    if (voiceOnly && typeof voiceOnly === "object") delete (voiceOnly as any).social_proof;

    const summary =
      typeof profile?.summary === "string" && profile.summary.length > 0
        ? profile.summary
        : (brand.brand_voice as string | null) || "";

    const updatePayload: Record<string, unknown> = {
      voice_profile: voiceOnly,
      voice_profile_generated_at: new Date().toISOString(),
      brand_voice: summary,
    };
    if (socialProof) {
      updatePayload.social_proof = socialProof;
      updatePayload.social_proof_generated_at = new Date().toISOString();
    }

    const { error: updErr } = await admin
      .from("brands")
      .update(updatePayload)
      .eq("id", brandId)
      .select()
      .single();

    if (updErr) {
      console.error("Update error", updErr);
      return json({ error: "Couldn't save voice profile" }, cors, 200);
    }

    return json({ voice_profile: voiceOnly, brand_voice: summary, social_proof: socialProof }, cors, 200);
  } catch (e: any) {
    console.error("analyze-brand-voice error", e?.message || e);
    return json({ error: e?.message || "Unexpected error" }, cors, 200);
  }
});
