import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requirePaidUser } from "../_shared/check-subscription.ts";

const SYSTEM_PROMPT = `You are LUMI's intent router for the Ads by LUMI app. The user typed something into the "How can LUMI help today?" command bar. Decide whether to ROUTE them somewhere in the app, or CONVERSE with them when the request is vague, diagnostic, or needs clarification.

OUTPUT CONTRACT — you MUST call the route_or_converse tool. No prose outside the tool call.

CAPABILITY / ROUTE MAP — pick the most specific match:
- "/create" — Create New campaign wizard. Use routeParams.goal when the user names one. Allowed goals: leads, sales, traffic, awareness, engagement, video_views. ("run ads for my webinar" → leads).
- "/strategy" — Ad strategy overview: how their ads work together, set business goals, see funnel health.
- "/strategy-builder" — Step 1 of building a NEW campaign's strategy (only if they're already inside Create New).
- "/ad-performance" — Live Ads / Big Picture: overall performance, "how are my ads doing".
- "/live-ads/:campaignId" — Closer Look at a SPECIFIC campaign by id. Use ONLY when context includes a clearly matching campaign.
- "/campaigns" — In-progress / draft campaigns.
- "/boards" — Inspiration boards.
- "/creative-studio" — My Creative / generate creative from board.
- "/creative-toolkit" — Creative tools & resources.
- "/dashboard" — My Brand dashboard.
- "/offers" — Offers / what I'm promoting.
- "/style" — Brand design guide.
- "/meta-settings" — Connect / manage Meta ad account.
- "/tracking-setup" — Pixel / tracking setup.
- "/glossary" — Ads terminology.
- "/home" — "What should I do today" / "what needs me" / Quick List / LUMI suggests.
- "/tasks" — User's task list.
- "/settings" — Account / billing / team / password.
- "/office-hours" — Human help / talk to a person.

RULES:
1. mode = "route" ONLY when intent is clear AND maps cleanly to a destination. Otherwise mode = "converse".
2. When mode = "converse", reply MUST be 1–3 sentences in plain language, AND you MUST include 1–3 "actions" so the user is never stuck in a dead-end chat.
3. NEVER fall back to /create when unsure. If unsure, converse with a short clarifying question and 2–3 best-guess action buttons.
4. For performance / diagnostic questions ("why is my CPL up?", "is X working?"): do NOT invent numbers. If context includes a matching campaign, route to /live-ads/:campaignId. Otherwise converse and offer to open Big Picture (/ad-performance).
5. For "what should I do today / this week / what needs me" → route to /home.
6. For "connect meta / facebook / instagram / pixel / tracking" → route to /meta-settings or /tracking-setup.
7. For bug-like input ("broken", "not working", "stuck") → converse, offer Report Bug (action type "open", target "bug_report") and Get Human Help (route /office-hours).
8. Speak in coach language — offers, funnels, launches — never "ABO" or "ad set".

ACTION SHAPE:
- type "route": navigates. Must include target = a route (with /:campaignId resolved if relevant). May include routeParams.
- type "task": creates a task in the user's task list. Must include target = { title, link_to? }.
- type "open": opens a modal/flow in-app. Allowed targets: "bug_report", "quick_list", "create_from_board".

EXAMPLES:
- "I want to run ads for my webinar" → route /create, routeParams { goal: "leads" }
- "make a creative from my board" → route /creative-studio, routeParams { source: "board" }
- "what should I do today?" → route /home
- "connect my meta account" → route /meta-settings
- "help me with my ads" → converse: one clarifying question + actions [route /create "Launch a campaign", route /ad-performance "Check performance", route /creative-studio "Make creative"]
- "why is my cost per lead up?" with one matching campaign in context → route /live-ads/<id>
- "why is my cost per lead up?" without a clear match → converse: "Want me to dig into a specific campaign?" + 2 route actions to candidate campaigns or /ad-performance.`;

const TOOL = {
  type: "function",
  function: {
    name: "route_or_converse",
    description: "Decide whether to route the user or converse with them.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["route", "converse"] },
        route: { type: "string", description: "App route, required when mode = route." },
        routeParams: {
          type: "object",
          description: "Optional params to pass to the destination (e.g. { goal: 'leads' }).",
          additionalProperties: true,
        },
        reply: {
          type: "string",
          description: "Plain-language reply when mode = converse. 1–3 sentences.",
        },
        actions: {
          type: "array",
          description: "Actionable next steps. Required when mode = converse, optional when mode = route.",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              type: { type: "string", enum: ["route", "task", "open"] },
              target: {
                description: "Route string, open key, or task object { title, link_to? }.",
              },
              routeParams: { type: "object", additionalProperties: true },
            },
            required: ["label", "type", "target"],
          },
        },
      },
      required: ["mode"],
    },
  },
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePaidUser(req, corsHeaders);
    if (gate.blocked) return gate.blocked;
    const userId = gate.userId!;

    const body = await req.json().catch(() => ({}));
    const messages: { role: "user" | "assistant"; content: string }[] = Array.isArray(body.messages)
      ? body.messages.slice(-12)
      : body.text
      ? [{ role: "user", content: String(body.text) }]
      : [];
    const brandId: string | undefined = body.brandId;

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages or text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Pull lightweight context — brand, recent campaigns, offers
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let contextBlock = "";
    if (brandId) {
      const [brandRes, wsRes, offersRes] = await Promise.all([
        supabase.from("brands").select("id, name, meta_account_id").eq("id", brandId).maybeSingle(),
        supabase
          .from("campaign_workspaces")
          .select("id, name, objective, offer_name, meta_campaign_status")
          .eq("brand_id", brandId)
          .eq("archived", false)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("offers")
          .select("id, name")
          .eq("brand_id", brandId)
          .eq("archived", false)
          .limit(15),
      ]);
      const b = brandRes.data;
      contextBlock += `\n--- Context ---\nBrand: ${b?.name || "(unknown)"} | Meta connected: ${b?.meta_account_id ? "yes" : "no"}\n`;
      if (offersRes.data?.length) {
        contextBlock += `Offers: ${offersRes.data.map((o: any) => o.name).join(", ")}\n`;
      }
      if (wsRes.data?.length) {
        contextBlock += `Campaigns (id — name — offer — status):\n`;
        for (const w of wsRes.data as any[]) {
          contextBlock += `- ${w.id} — ${w.name} — ${w.offer_name || "no offer"} — ${w.meta_campaign_status || "draft"}\n`;
        }
      }
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextBlock },
          ...messages,
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "route_or_converse" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("[intent-router] gateway error", aiRes.status, t);
      if (aiRes.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (aiRes.status === 402)
        return new Response(JSON.stringify({ error: "AI credits depleted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      throw new Error(`AI gateway error ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = null;
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("[intent-router] parse error", e);
      }
    }

    if (!parsed) {
      parsed = {
        mode: "converse",
        reply:
          "I'm not sure what to do with that yet — pick one to get going.",
        actions: [
          { label: "Launch a campaign", type: "route", target: "/create" },
          { label: "Check performance", type: "route", target: "/ad-performance" },
          { label: "Make creative", type: "route", target: "/creative-studio" },
        ],
      };
    }

    // Safety: never silently route to /create as a fallback when intent isn't clear.
    if (
      parsed.mode === "route" &&
      (!parsed.route || typeof parsed.route !== "string")
    ) {
      parsed = {
        mode: "converse",
        reply: "Tell me a little more — what's the goal?",
        actions: [
          { label: "Launch a campaign", type: "route", target: "/create" },
          { label: "Check performance", type: "route", target: "/ad-performance" },
          { label: "Make creative", type: "route", target: "/creative-studio" },
        ],
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[intent-router] error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
