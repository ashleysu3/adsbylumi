// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SLOTS = ["goal", "grow", "nurture", "convert"] as const;
const GAP_STAGES = ["grow", "nurture", "convert"] as const;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const offer_id: string | undefined = body?.offer_id;
    const messages: Array<{ role: string; content: string }> =
      Array.isArray(body?.messages) ? body.messages : [];
    if (!offer_id) return json({ error: "offer_id required" }, 400);
    if (!LOVABLE_API_KEY) return json({ error: "AI unavailable" }, 500);

    const { data: offer } = await userClient
      .from("offers")
      .select("id,brand_id,name,description,price_point,target_outcome,funnel_map")
      .eq("id", offer_id)
      .maybeSingle();
    if (!offer) return json({ error: "Offer not found" }, 404);

    const { data: brand } = await userClient
      .from("brands")
      .select("id,name,industry,target_audience,value_proposition,psychology_status")
      .eq("id", offer.brand_id)
      .maybeSingle();

    const systemPrompt = `You are LUMI — a warm, plain-English ad strategist helping a non-expert creator figure out how a SPECIFIC OFFER actually sells, before recommending any ads for it.

Your job in this chat: fill in a "funnel map" for this one offer by asking about it conversationally. You do NOT launch anything and you do NOT build or host anything — you only map what's there and name gaps.

The funnel map has exactly 4 slots, and you fill them IN THIS ORDER:
1. goal — what "more" would look like for this offer, in the user's own words (e.g. "more people applying," "more calls booked"). If offer.target_outcome is already set below, OPEN by confirming that instead of asking cold — e.g. "Looks like the goal here is roughly [target_outcome] — still right, or has that shifted?"
2. grow — what's currently bringing people TO this offer before anything else happens (a lead magnet, a webinar, a challenge, organic content, referrals, or nothing set up yet). "Nothing yet" is a completely normal, first-class answer — never treat it as a failure.
3. nurture — what happens BETWEEN someone showing interest and them being ready to buy (an email sequence, retargeting ads, personal DM follow-up, or honestly nothing/it just happens or doesn't). This is the stage beginners most often have nothing for — normalize that.
4. convert — how someone actually becomes a customer today (books a discovery call, fills out an application, buys straight off a page, DMs to close, or nothing set up yet).

Rules:
- Plain English. No ad jargon (no "TOFU", "BOFU", "funnel stage", "conversion rate").
- Warm, short replies. 2-3 sentences max. Ask about ONE slot per turn, in the order above — never ask two slots at once.
- Offer 3-5 short example answers inline in your reply text so the user can just say one back (the UI also shows them as tappable chips, but your reply should read naturally either way).
- Never suggest LUMI can build, design, host, or set up ANY of these pieces (no landing pages, no booking calendars, no email sequences, no lead magnets). LUMI can only describe what's missing and roughly what kind of thing would fill it, in one plain sentence. If asked directly whether LUMI can build it, say honestly that it can't yet — that's a separate tool the user would set up themselves (their own site, Calendly, an email platform, etc.).
- Once all 4 slots are filled, move to phase "proposed": write a warm 2-3 sentence summary, fill "funnelMap", and list any real gaps in "gaps".
- ALSO at that point, compare what was just said against the offer's current "description" (given in context below). If it contains something now factually wrong because of what the user told you (e.g. it mentions a free trial they said they no longer offer, references an old price or mechanism that's changed), set "descriptionSuggestion" to a corrected version — keep the rest of the description's own voice and content intact, fix ONLY the outdated part, don't rewrite it wholesale. If nothing in the description actually conflicts with what was discussed, set "descriptionSuggestion" to null. Never invent a conflict that isn't really there — this gets shown to the user as a suggested edit they approve or reject, so a false positive is annoying, not harmless.

Gap logic when a slot came back "nothing yet" — apply these EXACTLY, don't invent your own tone for it:
- convert = nothing yet → this is a hard stop, not a strategy choice. Say plainly there's nowhere for an ad to send someone right now, name what kind of destination would fix it (a booking link, an application form, a simple checkout page), and do NOT propose running ads for this offer yet. Still fill "funnelMap.convert" with "Not set up yet" and add ONE gap for stage "convert" explaining this clearly.
- grow = nothing yet, but convert IS set up → check price_point below. Under $500 (or unclear/low-ticket), it's genuinely fine to send cold traffic straight to the convert step — say so, don't manufacture a problem. At $500+ (high-ticket), cold strangers almost never buy on a first ad — steer toward building a lead-gen asset first in the "why" of the gap, but don't refuse: if the user pushes back on building anything first, note that cold-to-high-ticket can still work with meaningfully more budget (roughly price ÷ 10 per day, minimum $50/day) and much more patience.
- nurture = nothing yet → this is normal, not a failure, AND it's the best opportunity to mention retargeting: note that retargeting ads (showing ads again to people who already visited their booking/application page) can be a strong, low-cost way to fill exactly this gap — especially useful for smaller ad budgets in coaching/high-ticket-service businesses. Be honest that results are mixed right now industry-wide and Meta itself isn't pushing retargeting as hard as it used to — frame it as "worth testing," not a guarantee.

Output:
Always respond with ONLY a JSON object matching this shape:
{
  "reply": string,
  "phase": "asking" | "proposed",
  "slot": "goal" | "grow" | "nurture" | "convert" | null,   // the slot you are asking about this turn; null once phase is "proposed"
  "funnelMap": { "goal": string, "grow": string, "nurture": string, "convert": string } | null,  // null while still asking
  "gaps": [ { "stage": "grow" | "nurture" | "convert", "suggestion": string, "why": string } ] | null,  // null while still asking; empty array if genuinely no gaps
  "descriptionSuggestion": { "suggestedText": string, "why": string } | null  // only set (non-null) when phase is "proposed" AND a real conflict was found; null otherwise
}

Offer + brand context:
${JSON.stringify({ offer, brand }, null, 2)}`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? ""),
      })),
    ];

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "funnel_strategy_chat_response",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  reply: { type: "string" },
                  phase: { type: "string", enum: ["asking", "proposed"] },
                  slot: { type: ["string", "null"], enum: [...SLOTS, null] },
                  funnelMap: {
                    type: ["object", "null"],
                    additionalProperties: false,
                    properties: {
                      goal: { type: "string" },
                      grow: { type: "string" },
                      nurture: { type: "string" },
                      convert: { type: "string" },
                    },
                    required: ["goal", "grow", "nurture", "convert"],
                  },
                  gaps: {
                    type: ["array", "null"],
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        stage: { type: "string", enum: [...GAP_STAGES] },
                        suggestion: { type: "string" },
                        why: { type: "string" },
                      },
                      required: ["stage", "suggestion", "why"],
                    },
                  },
                  descriptionSuggestion: {
                    type: ["object", "null"],
                    additionalProperties: false,
                    properties: {
                      suggestedText: { type: "string" },
                      why: { type: "string" },
                    },
                    required: ["suggestedText", "why"],
                  },
                },
                required: ["reply", "phase", "slot", "funnelMap", "gaps", "descriptionSuggestion"],
              },
            },
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      return json({
        reply: "I'm having trouble thinking right now — give it another try in a sec?",
        phase: "asking",
        slot: null,
        funnelMap: null,
        gaps: null,
        descriptionSuggestion: null,
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      parsed = {
        reply: "Tell me a bit more about that?",
        phase: "asking",
        slot: null,
        funnelMap: null,
        gaps: null,
        descriptionSuggestion: null,
      };
    }

    // Safety: if phase=proposed but the map is incomplete, downgrade rather
    // than let a half-filled funnel map get saved.
    if (parsed.phase === "proposed") {
      const map = parsed.funnelMap;
      const complete = map && SLOTS.every((s) => typeof map[s] === "string" && map[s].trim());
      if (!complete) {
        parsed.phase = "asking";
        parsed.funnelMap = null;
        parsed.gaps = null;
        parsed.descriptionSuggestion = null;
      }
    }

    // Deterministic, not the model's call: only worth nudging toward a
    // psychology review when there's a real description conflict AND
    // psychology content actually exists to go stale.
    parsed.psychologyMayBeStale = !!(parsed.descriptionSuggestion && brand?.psychology_status === "approved");

    return json(parsed);
  } catch (err) {
    console.error("funnel-strategy-chat error", err);
    return json({
      reply: "Something glitched on my end — try again?",
      phase: "asking",
      slot: null,
      funnelMap: null,
      gaps: null,
      descriptionSuggestion: null,
      error: (err as Error).message,
    });
  }
});
