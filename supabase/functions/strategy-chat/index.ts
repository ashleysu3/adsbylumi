// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const GOAL_IDS = [
  "promote_offer",
  "get_leads",
  "book_calls",
  "dm_leads",
  "grow_social",
  "local",
  "event_location",
] as const;

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
    const brand_id: string | undefined = body?.brand_id;
    const messages: Array<{ role: string; content: string }> =
      Array.isArray(body?.messages) ? body.messages : [];
    if (!brand_id) return json({ error: "brand_id required" }, 400);
    if (!LOVABLE_API_KEY) return json({ error: "AI unavailable" }, 500);

    // Load minimal brand context for grounding
    const { data: brand } = await userClient
      .from("brands")
      .select("id,name,industry,target_audience,value_proposition")
      .eq("id", brand_id)
      .maybeSingle();

    const { data: offers } = await userClient
      .from("offers")
      .select("name,description,price_point,target_outcome")
      .eq("brand_id", brand_id)
      .limit(5);

    const systemPrompt = `You are LUMI — a warm, plain-English ad strategist for non-expert creators.

Your job in this chat: figure out what the user actually wants to accomplish with ads, then propose ONE clear strategy. You do NOT launch anything. You only propose.

Rules:
- Plain English. No ad jargon (no "TOFU", "BOFU", "ABO", "lookalike", "CPM").
- Warm, short replies. 2–3 sentences max.
- Ask at most 1–2 clarifying questions total before proposing. Do not interrogate.
- If the user says something vague like "more traffic", ask what they want people to DO once they arrive, and steer them to the right objective (usually get_leads, not literal traffic).
- When you propose, classify their intent into EXACTLY ONE of these goal ids:
  • promote_offer — sell a specific paid offer (course, product, service)
  • get_leads — collect emails / signups / opt-ins
  • book_calls — get discovery / sales calls booked
  • dm_leads — start Instagram or Messenger DM conversations
  • grow_social — gain followers / engagement on social
  • local — get foot traffic or local customers in a specific area
  • event_location — promote an in-person event tied to a location

Output:
Always respond with ONLY a JSON object matching this shape:
{
  "reply": string,                      // chat message to show the user (warm, short, plain English)
  "phase": "clarifying" | "proposed",
  "goalId": string | null,              // one of the goal ids above; null when clarifying
  "strategy": {                         // null when clarifying
    "campaignType": string,             // e.g. "Engagement → Instagram/Messenger DMs"
    "kpiLabel": string,                 // what we'll measure success by, in plain English
    "audience": string,                 // who we'll show it to
    "startingBudget": string,           // e.g. "$20/day to start"
    "why": string                       // 1–2 sentence plain-English rationale
  } | null
}

Default starting budget when unsure: "$20/day to start".
Default audience when unsure: "Broad+ (LUMI's smart default — no narrow targeting)".

High-ticket rule:
- Any offer priced at $500 or more is "high-ticket." Cold strangers almost never buy high-ticket on a first ad.
- For high-ticket promote_offer / book_calls intents, propose a SALES campaign to a WARM audience ONLY (existing list, retargeting, page/IG engagers, past customers), paired with a cold top-of-funnel campaign (engagement, traffic, awareness, or leads) that fills the warm pool over time. Say this plainly in "why".
- If the user insists on running a high-ticket sales campaign cold, do not refuse — but warn them in "why" that the budget needs to be significantly higher (recommend at least price ÷ 10 per day, minimum $50/day) for any real chance of working, and set "startingBudget" to that floor (e.g. "$100/day to start").

Brand context:
${JSON.stringify({ brand, offers }, null, 2)}`;

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
              name: "strategy_chat_response",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  reply: { type: "string" },
                  phase: { type: "string", enum: ["clarifying", "proposed"] },
                  goalId: {
                    type: ["string", "null"],
                    enum: [...GOAL_IDS, null],
                  },
                  strategy: {
                    type: ["object", "null"],
                    additionalProperties: false,
                    properties: {
                      campaignType: { type: "string" },
                      kpiLabel: { type: "string" },
                      audience: { type: "string" },
                      startingBudget: { type: "string" },
                      why: { type: "string" },
                    },
                    required: [
                      "campaignType",
                      "kpiLabel",
                      "audience",
                      "startingBudget",
                      "why",
                    ],
                  },
                },
                required: ["reply", "phase", "goalId", "strategy"],
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
        phase: "clarifying",
        goalId: null,
        strategy: null,
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      parsed = {
        reply: "Tell me a bit more about what you want to happen?",
        phase: "clarifying",
        goalId: null,
        strategy: null,
      };
    }

    // Safety: if phase=proposed but missing pieces, downgrade
    if (parsed.phase === "proposed" && (!parsed.goalId || !parsed.strategy)) {
      parsed.phase = "clarifying";
      parsed.goalId = null;
      parsed.strategy = null;
    }

    return json(parsed);
  } catch (err) {
    console.error("strategy-chat error", err);
    return json({
      reply: "Something glitched on my end — try again?",
      phase: "clarifying",
      goalId: null,
      strategy: null,
      error: (err as Error).message,
    });
  }
});
