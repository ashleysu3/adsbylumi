import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: any) => console.log(`[GEN-PARTNER-AI] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const SCHEMA = {
  type: "object",
  properties: {
    partner_title: { type: "string", description: "Short title/subtitle for their portal (max ~60 chars). e.g. 'Wedding Industry Strategist for Coaches'." },
    partner_photo_url: { type: "string", description: "Best logo or headshot URL from the website branding scan. Empty if none found." },
    recommended_strategies: {
      type: "array",
      description: "4 specific ideas for how THIS partner can market Lumi to THEIR audience. Action-oriented, advisory tone.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
    share_resources: {
      type: "array",
      description: "6 customized swipe-file items: a mix of ready-to-post copy, marketing ideas, and collaboration ideas tailored to their audience. type must be one of: copy, idea, collab.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "If type=copy, this IS the full ready-to-paste post/email/caption. Otherwise a 1-2 sentence pitch." },
          type: { type: "string", enum: ["copy", "idea", "collab"] },
          url: { type: "string", description: "Optional. Leave empty if none." },
        },
        required: ["title", "description", "type"],
      },
    },
    recommended_features: {
      type: "array",
      description: "4 Lumi features this partner's audience would find most helpful/interesting, each with ready-to-share copy the partner can post.",
      items: {
        type: "object",
        properties: {
          feature: { type: "string", description: "Name of the Lumi feature (e.g. 'AI Ad Script Generator', 'Weekly Performance Reports')." },
          why_audience_cares: { type: "string", description: "1-2 sentence explanation of why THIS audience specifically would care." },
          share_copy: { type: "string", description: "Ready-to-paste social/email caption (~2-4 sentences) the partner can post to introduce this feature to their audience. Include a soft mention of using their partner code." },
        },
        required: ["feature", "why_audience_cares", "share_copy"],
      },
    },
  },
  required: ["partner_title", "recommended_strategies", "share_resources", "recommended_features"],
};


Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" });

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData.user?.id;
    if (!userId) return json({ error: "Unauthorized" });

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" });

    const { application_id } = await req.json();
    if (!application_id) return json({ error: "application_id required" });

    const { data: app, error: appErr } = await admin
      .from("partner_applications")
      .select("first_name, last_name, email, website, audience_description, promotion_plan, how_will_you_share")
      .eq("id", application_id)
      .maybeSingle();
    if (appErr || !app) return json({ error: "Application not found" });

    // 1. Firecrawl the website for content + branding (logo).
    let pageMarkdown = "";
    let pageSummary = "";
    let logoUrl = "";
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (app.website && fcKey) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: app.website,
            formats: ["markdown", "summary", "branding"],
            onlyMainContent: true,
          }),
        });
        const fcData = await fcRes.json();
        const doc = fcData.data || fcData;
        pageMarkdown = (doc.markdown || "").slice(0, 8000);
        pageSummary = doc.summary || "";
        logoUrl = doc.branding?.images?.logo || doc.branding?.logo || doc.metadata?.ogImage || "";
        log("Firecrawl OK", { hasMd: !!pageMarkdown, hasLogo: !!logoUrl });
      } catch (e: any) {
        log("Firecrawl failed", { msg: e.message });
      }
    }

    // 2. Lovable AI with structured output
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" });

    const systemPrompt = `You help the Lumi team prepare custom partner portals.
Lumi (adsbylumi.com) is a Meta Ads assistant for coaches, course creators, and service providers — it builds strategy, scripts, copy, and creative direction without requiring ads expertise.
Given a partner's website + audience info, produce a customized portal package: a short title/subtitle, recommended ways for THEM to market Lumi to THEIR audience, and a swipe file (ready-to-paste copy + marketing ideas + collaboration ideas with the Lumi team).
Tone: warm, advisory ("We recommend…"), no hype, no "secret/guaranteed/overnight" language. Be specific to the partner's actual niche.
Never suggest landing-page or retargeting optimizations.`;

    const userPrompt = `PARTNER
Name: ${app.first_name} ${app.last_name}
Website: ${app.website || "(none)"}
Audience description: ${app.audience_description || "(not provided)"}
Promotion plan: ${app.promotion_plan || app.how_will_you_share || "(not provided)"}

WEBSITE SUMMARY
${pageSummary || "(none)"}

WEBSITE CONTENT (truncated)
${pageMarkdown || "(none)"}

DETECTED LOGO URL (use as partner_photo_url if it looks like a real logo): ${logoUrl || "(none)"}

Generate the portal package now. For share_resources, mix the 6 items as roughly: 2x type=copy (full ready-to-post emails or social captions inviting their audience to try Lumi with their partner code), 2x type=idea (specific marketing campaign ideas they can run), 2x type=collab (ideas for joint things the Lumi team could do with them — webinar, guest workshop, swipe-file giveaway, podcast, etc).`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_partner_portal",
            description: "Emit the structured partner portal package.",
            parameters: SCHEMA,
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_partner_portal" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      log("AI error", { status: aiRes.status, txt: txt.slice(0, 400) });
      if (aiRes.status === 429) return json({ error: "Rate limited. Please try again in a moment." });
      if (aiRes.status === 402) return json({ error: "Lumi AI credits exhausted. Add credits in Settings." });
      return json({ error: `AI request failed (${aiRes.status})` });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return json({ error: "AI returned no structured output" });

    let parsed: any;
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { return json({ error: "AI returned malformed JSON" }); }

    // Prefer scraped logo if AI left photo blank
    if (!parsed.partner_photo_url && logoUrl) parsed.partner_photo_url = logoUrl;

    return json({
      success: true,
      partner_display_name: `${app.first_name} ${app.last_name}`.trim(),
      partner_title: parsed.partner_title || "",
      partner_photo_url: parsed.partner_photo_url || "",
      recommended_strategies: parsed.recommended_strategies || [],
      share_resources: parsed.share_resources || [],
    });
  } catch (e: any) {
    log("ERROR", { message: e.message });
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 200, headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});
