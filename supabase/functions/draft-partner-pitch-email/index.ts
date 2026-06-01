import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: any) => console.log(`[DRAFT-PARTNER-PITCH] ${s}${d ? " " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" });

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData.user?.id;
    if (!userId) return json({ error: "Unauthorized" });

    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" });

    const body = await req.json();
    const {
      partner_display_name,
      partner_email,
      partner_trial_code,
      partner_title,
      referral_link,
      selected_ideas = [],
      selected_resources = [],
      booking_url = "",
      reply_to_email = "",
    } = body;

    if (!partner_display_name) return json({ error: "partner_display_name required" });

    // Recent updates (what's new) to mention
    const { data: updates } = await admin
      .from("partner_updates")
      .select("title, body")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(3);

    const portalUrl = "https://adsbylumi.com/partner-portal";
    const shareUrl = partner_trial_code ? `https://adsbylumi.com/?code=${partner_trial_code}` : "";

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" });

    const systemPrompt = `You draft warm, concise partner pitch emails from the Lumi team (adsbylumi.com — a Meta Ads assistant for coaches, course creators, and service providers).
Tone: warm, advisory, editorial — like a smart marketing friend. No hype, no "secret/guaranteed/overnight" language.
The goal: re-engage a partner with a customized set of marketing ideas tailored to their audience, plus easy access to their portal, referral link, swipe files, and what's new.
Output ONLY JSON: { "subject": "...", "body": "..." } — body is plain text with simple line breaks, NO markdown formatting, NO HTML.`;

    const userPrompt = `PARTNER
Name: ${partner_display_name}
Title/niche: ${partner_title || "(not set)"}
Trial code: ${partner_trial_code || "(none)"}
Partner portal: ${portalUrl}
Referral link: ${referral_link || shareUrl || "(none)"}

SELECTED MARKETING IDEAS TO PITCH (${selected_ideas.length})
${selected_ideas.map((i: any, n: number) => `${n + 1}. ${i.title}\n   ${i.description}${i.custom_notes ? `\n   Custom notes from us: ${i.custom_notes}` : ""}`).join("\n\n") || "(none)"}

CUSTOMIZED RESOURCES THEY HAVE WAITING (${selected_resources.length})
${selected_resources.map((r: any) => `- [${r.type || "resource"}] ${r.title}: ${r.description}`).join("\n") || "(none)"}

WHAT'S NEW IN LUMI
${(updates || []).map((u: any) => `- ${u.title}${u.body ? ": " + u.body.slice(0, 140) : ""}`).join("\n") || "(no recent updates)"}

CALL-TO-ACTION DETAILS
Book-a-call link with Ashley: ${booking_url || "(none — omit the booking option)"}
Reply-to email: ${reply_to_email || "(use a plain reply)"}

Write a friendly email (subject + body) that:
1. Greets them by first name only.
2. Briefly mentions we've put together some custom marketing ideas for THEIR audience.
3. Highlights 2-3 of the selected ideas in a quick scannable way (1 line each).
4. Mentions their partner portal has the full set + customized swipe files / copy / graphics ready to grab.
5. Includes the portal link (${portalUrl}) and their referral link (${referral_link || shareUrl}) clearly.
6. Mentions 1 thing that's new in Lumi if relevant to their audience.
7. Ends with a clear two-option CTA so they know exactly how to move forward:
   (a) Reply to this email with the numbers of the ideas they'd like to explore further (reference the numbered ideas above), OR
   (b) ${booking_url ? `Book a call with Ashley to brainstorm together: ${booking_url}` : "Reply to set up a quick brainstorm call with Ashley"}.
   Make the two options feel low-pressure and easy.
Keep body under ~240 words. Sign off "— The Lumi team".`;

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
            name: "emit_email",
            description: "Emit the drafted pitch email.",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string" },
                body: { type: "string" },
              },
              required: ["subject", "body"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_email" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      log("AI error", { status: aiRes.status, txt: txt.slice(0, 400) });
      if (aiRes.status === 429) return json({ error: "Rate limited. Try again in a moment." });
      if (aiRes.status === 402) return json({ error: "Lumi AI credits exhausted." });
      return json({ error: `AI request failed (${aiRes.status})` });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return json({ error: "AI returned no output" });
    let parsed: any;
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { return json({ error: "AI returned malformed JSON" }); }

    return json({
      success: true,
      to: partner_email || "",
      subject: parsed.subject || "",
      body: parsed.body || "",
    });
  } catch (e: any) {
    log("ERROR", { message: e.message });
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 200, headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});
