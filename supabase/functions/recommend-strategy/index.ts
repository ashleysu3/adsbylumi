// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const brand_id: string | undefined = body?.brand_id;
    const user_goal: string | undefined = body?.user_goal;
    const offer_id: string | undefined = body?.offer_id;
    // A short user-written line on WHAT they're actually offering (e.g. "a free
    // guide on scaling ad spend", "a 20-min discovery call") — collected during
    // onboarding before any `offers` row exists. Without this, a pre-signup
    // brand with no offer gives the AI nothing to disambiguate a lead-magnet
    // funnel from a DM funnel from a call-booking funnel, all of which satisfy
    // "get_leads" equally well.
    const offer_hint: string | undefined =
      typeof body?.offer_hint === "string" && body.offer_hint.trim() ? body.offer_hint.trim() : undefined;
    if (!brand_id) return json({ error: "brand_id required" }, 400);

    // Load brand + offers + audiences (scoped to user via RLS)
    const { data: brand, error: brandErr } = await userClient
      .from("brands")
      .select(
        "id,name,industry,website_url,target_audience,value_proposition,brand_voice",
      )
      .eq("id", brand_id)
      .maybeSingle();
    if (brandErr || !brand) {
      return json({ error: "Brand not found" }, 404);
    }

    // If an offer_id was provided, scope offers to just that one so the AI
    // builds a strategy for the specific thing the user wants to advertise
    // (a webinar, a smaller product, etc.) — not the brand's default offer.
    let offersQuery = userClient
      .from("offers")
      .select("id,name,description,price_point,target_outcome,url,page_goal")
      .eq("brand_id", brand_id);
    if (offer_id) {
      offersQuery = offersQuery.eq("id", offer_id);
    } else {
      offersQuery = offersQuery.limit(10);
    }

    const [{ data: offers }, { data: audiences }, { data: templates }] =
      await Promise.all([
        offersQuery,
        userClient
          .from("audiences")
          .select("name,demographics,psychographics,pain_points,desires")
          .eq("brand_id", brand_id)
          .limit(10),
        admin
          .from("recommended_strategies")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

    const brandSnapshot = {
      brand: brand,
      offers: offers ?? [],
      selected_offer: offer_id ? (offers ?? [])[0] ?? null : null,
      audiences: audiences ?? [],
      user_goal,
      offer_hint,
    };

    // If no templates exist OR no API key, log a request immediately
    if (!templates || templates.length === 0 || !LOVABLE_API_KEY) {
      const { data: req } = await admin
        .from("strategy_requests")
        .insert({
          user_id: user.id,
          brand_id,
          brand_snapshot: brandSnapshot,
          user_goal: user_goal ?? null,
          status: "pending",
        })
        .select("id")
        .single();
      return json({ pending: true, request_id: req?.id });
    }

    // Ask AI to pick the best match (structured output)
    const templateSummaries = templates.map((t: any) => ({
      slug: t.slug,
      name: t.name,
      industry: t.industry,
      business_model: t.business_model,
      primary_goals: t.primary_goals,
      keywords: t.keywords,
      description: t.description,
    }));

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
          messages: [
            {
              role: "system",
              content:
                "You are LUMI, an ad strategist. Pick the single best matching strategy template for THIS specific offer + goal. REQUIRED: match the funnel to what the user is actually promoting. Do NOT default to the most generic / broadest option. Specifically:\n" +
                "- A webinar / free training / masterclass / workshop offer → webinar funnel.\n" +
                "- A free download / guide / checklist / PDF / quiz / lead magnet → lead-magnet funnel.\n" +
                "- A low-ticket paid challenge / bootcamp / $27–$97 sprint → paid-challenge funnel.\n" +
                "- A high-ticket coaching / consulting / 1:1 / mastermind / application offer → DM / conversation funnel.\n" +
                "- A podcast / show / clip-based growth play → podcast-grow funnel.\n" +
                "- A standard paid product or course with a sales page (no webinar, no challenge) → the matching sales funnel (e.g. coach-course-creator-3step).\n" +
                "- A local in-person service → local-service funnel.\n" +
                "Use the offer name, description, price, page_goal, and the user_goal to decide. If there is no offer yet, brandSnapshot.offer_hint is the user's own words on what they're actually offering (e.g. 'a free discovery call', 'a free guide on X', 'my $997 program') — treat it as equally authoritative as a real offer's description/page_goal for picking the funnel type. A 'get_leads' goal with a call-shaped offer_hint should match a call/DM funnel, not a generic lead-magnet template, and vice versa. If user_goal is EXACTLY 'dm_leads', the user explicitly chose \"more DMs\" in onboarding — match a DM/conversation funnel, full stop, regardless of offer details. If user_goal is EXACTLY 'grow_social', the user explicitly chose \"more followers/engagement\" — match a growth/awareness funnel, never a lead or DM funnel. Only return no_match if literally none of the templates fit the offer type.\n\n" +
                "IMPORTANT — the template you match was AUTHORED once as a generic funnel shape, often using an illustrative example industry in its stored name/description (e.g. a template literally named 'Wedding Pros — Grow + Leads' really just means \"2-campaign lead-gen funnel\" and has nothing to do with weddings). NEVER let that stored name/description reach the user as-is. Always write a personalized_title and personalized_intro grounded in THIS brand's actual name, industry, and offer_hint/offer (e.g. 'Free Guide → Booked Calls for Acme Coaching', not a generic label) — never mention the template's original example industry unless it's genuinely this brand's industry too. Respond ONLY with JSON.",
            },
            {
              role: "user",
              content: JSON.stringify({ brandSnapshot, templates: templateSummaries }),
            },

          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "strategy_match",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  match_slug: { type: ["string", "null"] },
                  no_match: { type: "boolean" },
                  personalized_title: {
                    type: "string",
                    description: "A short, punchy plan name for THIS brand's offer/goal (e.g. 'Free Class → Booked Calls'). Never the template's original example-industry name.",
                  },
                  personalized_intro: { type: "string" },
                  reason: { type: "string" },
                },
                required: [
                  "match_slug",
                  "no_match",
                  "personalized_title",
                  "personalized_intro",
                  "reason",
                ],
              },
            },
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errTxt);
      // Fallback: log request rather than failing
      const { data: reqRow } = await admin
        .from("strategy_requests")
        .insert({
          user_id: user.id,
          brand_id,
          brand_snapshot: brandSnapshot,
          user_goal: user_goal ?? null,
          status: "pending",
          admin_notes: `AI matcher unavailable (${aiRes.status})`,
        })
        .select("id")
        .single();
      return json({ pending: true, request_id: reqRow?.id });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      parsed = {};
    }

    const detectedObjective = detectPrimaryObjective(brandSnapshot);

    const matchSlug: string | null = parsed?.no_match ? null : parsed?.match_slug;
    let matched = matchSlug
      ? templates.find((t: any) => t.slug === matchSlug)
      : null;

    // Guardrail: if the AI picked a template whose primary_goals clearly
    // conflict with the detected objective for this offer, prefer a template
    // whose goals align with the detected objective.
    const explicitGoal = String(user_goal || "").toLowerCase();
    const goalsAlignWithObjective = (goals: string[] | null | undefined, obj: string) => {
      const g = (goals ?? []).map((x) => String(x).toLowerCase());
      // "dm_leads" and "grow_social" are only ever set from an explicit binary
      // choice in onboarding ("more DMs" vs "more followers/engagement"), never
      // inferred — so they require an exact tag match on the template, not just
      // any template sharing the broader OUTCOME_LEADS/AWARENESS bucket. Without
      // this, dm_leads was reachable as the silent .find()-first fallback for
      // ANY free/lead-shaped offer (see detectPrimaryObjective), not just real
      // DM funnels — that's the bug this guards against.
      if (explicitGoal === "dm_leads") return g.includes("dm_leads");
      if (explicitGoal === "grow_social") return g.includes("grow_social");
      if (obj === "OUTCOME_LEADS") {
        return g.some((x) => ["get_leads", "book_calls"].includes(x));
      }
      if (obj === "OUTCOME_AWARENESS") {
        return g.some((x) => ["grow_social", "awareness"].includes(x));
      }
      // OUTCOME_SALES
      return g.some((x) => ["promote_offer", "sales"].includes(x));
    };

    if (matched && !goalsAlignWithObjective(matched.primary_goals, detectedObjective)) {
      const better = templates.find((t: any) =>
        goalsAlignWithObjective(t.primary_goals, detectedObjective),
      );
      if (better) {
        console.log(
          `Guardrail: AI picked ${matched.slug} but detected ${detectedObjective}; switching to ${better.slug}`,
        );
        matched = better;
      } else if (explicitGoal === "dm_leads" || explicitGoal === "grow_social") {
        // These two come from an explicit binary choice, not a guess — serving
        // a misaligned template (e.g. a DM funnel for someone who explicitly
        // asked for followers/engagement) is worse than a manual request.
        // No exactly-tagged template exists yet — queue for review below
        // instead of silently keeping the AI's mismatched pick.
        console.log(
          `Guardrail: no template tagged "${explicitGoal}" exists; queuing for manual review instead of serving ${matched.slug}`,
        );
        matched = null;
      }
    }

    // No match from AI → fall back to the best template for the detected
    // objective rather than queuing a manual request (which always felt like
    // the coach default).
    if (!matched) {
      matched = templates.find((t: any) =>
        goalsAlignWithObjective(t.primary_goals, detectedObjective),
      ) ?? null;
    }

    if (!matched) {
      const { data: reqRow } = await admin
        .from("strategy_requests")
        .insert({
          user_id: user.id,
          brand_id,
          brand_snapshot: brandSnapshot,
          user_goal: user_goal ?? null,
          status: "pending",
          admin_notes: parsed?.reason ?? null,
        })
        .select("id")
        .single();
      return json({ pending: true, request_id: reqRow?.id });
    }


    // Adapt the matched template's campaign objectives to the actual offer.
    // Templates are written generically (often defaulting to OUTCOME_SALES),
    // but the PRIMARY campaign must reflect what the user is promoting:
    //   - Free trial / webinar / opt-in / lead magnet → OUTCOME_LEADS
    //   - Paid product / course / coaching            → OUTCOME_SALES
    //   - "Just grow / awareness" goals               → OUTCOME_AWARENESS
    // Top-of-funnel (awareness) and warm retargeting layers are preserved
    // and aligned to the primary objective so the funnel stays coherent.
    const adapted = adaptCampaignsToOffer(matched, brandSnapshot);

    // Every seeded template was authored once as a generic funnel SHAPE, often
    // under an illustrative example-industry name (a template literally named
    // "Wedding Pros — Grow + Leads" gets matched to any brand with the same
    // 2-campaign lead-gen shape, regardless of actual industry). NEVER let that
    // raw name/description reach the user. Personalize both here, on the
    // object the frontend actually stores as `strategy` — not just as sibling
    // top-level fields, which the frontend previously dropped entirely.
    const personalizedTitle =
      (typeof parsed?.personalized_title === "string" && parsed.personalized_title.trim()) ||
      `${brand.name}'s recommended campaign`;
    const personalizedIntro =
      (typeof parsed?.personalized_intro === "string" && parsed.personalized_intro.trim()) ||
      `Based on what we see for ${brand.name}, this plan is the cleanest path forward.`;

    return json({
      matched: true,
      strategy: {
        ...adapted,
        name: personalizedTitle,
        description: personalizedIntro,
        personalized_title: personalizedTitle,
        personalized_intro: personalizedIntro,
        // Keep the original template identity available for debugging/admin use
        // without ever surfacing it in the UI.
        _template_slug: matched?.slug ?? null,
        _template_name: matched?.name ?? null,
      },
      personalized_intro: personalizedIntro,
    });
  } catch (err) {
    console.error("recommend-strategy error", err);
    return json({ error: (err as Error).message ?? "Unknown error" });
  }
});

function detectPrimaryObjective(
  snapshot: any,
): "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_AWARENESS" {
  const offer =
    snapshot?.selected_offer || (snapshot?.offers && snapshot.offers[0]) || {};
  const goal = String(snapshot?.user_goal || "").toLowerCase();

  // Explicit intent from a binary onboarding choice ("more DMs" vs "more
  // followers/engagement") always wins over guessing from offer text — there
  // is no offer page for a followers goal to read in the first place.
  if (goal === "dm_leads") return "OUTCOME_LEADS";
  if (goal === "grow_social") return "OUTCOME_AWARENESS";

  const fields = [
    offer?.name,
    offer?.description,
    offer?.page_goal,
    offer?.target_outcome,
    offer?.price_point,
    goal,
    // The user's own free-text answer to "what are they getting/what's the
    // call for" — the only concrete signal available before any `offers` row
    // exists (the whole pre-signup ad-first flow). A "leads" goal with an
    // offer_hint of "a free discovery call" should route to a call-booking
    // funnel, not the same generic lead-magnet template as "a free PDF guide".
    snapshot?.offer_hint,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" | ");

  const leadSignals = [
    "free trial", "trial", "webinar", "masterclass", "workshop", "challenge",
    "opt-in", "opt in", "optin", "signup", "sign up", "sign-up",
    "register", "registration", "lead magnet", "lead-magnet", "freebie",
    "free guide", "free download", "free pdf", "free ebook", "free quiz",
    "free call", "free consult", "discovery call", "book a call",
    "inquiry", "inquire", "waitlist", "email capture", "newsletter",
    "subscribe", "leads", "get leads",
  ];
  const awarenessSignals = [
    "awareness", "grow social", "grow my account", "grow following",
    "build audience", "brand awareness", "video views",
  ];
  const salesSignals = [
    "purchase", "buy now", "checkout", "sales page", "add to cart",
    "shop", "store", "ecommerce", "coaching package", "membership",
  ];

  const priceStr = String(offer?.price_point || "").toLowerCase();
  const nameStr = String(offer?.name || "").toLowerCase();
  const isFree =
    /\bfree\b|\$0\b|^0$|no cost|complimentary/.test(priceStr) ||
    /\bfree\b/.test(nameStr);

  // Check the offer's own formal page_goal enum ('purchase' | 'discovery_call'
  // | 'free_resource' | 'other', set directly in the Offer creation UI)
  // before falling back to fuzzy keyword matching in free-text fields below.
  // The keyword lists don't contain these exact enum strings (e.g.
  // "discovery call" with a space never matches the stored "discovery_call"
  // with an underscore), so a free lead-magnet offer whose name/description
  // didn't happen to also contain a matching keyword was silently falling
  // through to the OUTCOME_SALES default.
  const pageGoal = String(offer?.page_goal || "").toLowerCase().trim();
  if (pageGoal === "free_resource" || pageGoal === "discovery_call") return "OUTCOME_LEADS";
  if (pageGoal === "purchase") return "OUTCOME_SALES";

  const hasLead = leadSignals.some((s) => fields.includes(s));
  const hasAwareness = awarenessSignals.some((s) => fields.includes(s));
  const hasSale = salesSignals.some((s) => fields.includes(s));

  if (isFree || hasLead) return "OUTCOME_LEADS";
  if (hasAwareness && !hasSale) return "OUTCOME_AWARENESS";
  return "OUTCOME_SALES";
}

function classifyRole(c: any): "awareness" | "primary" | "retarget" {
  const obj = String(c?.objective || "").toUpperCase();
  const name = String(c?.name || "").toLowerCase();
  const aud = String(c?.audience || "").toLowerCase();
  if (
    obj === "OUTCOME_AWARENESS" ||
    /awareness|top of funnel|tof|educational/.test(name)
  ) {
    return "awareness";
  }
  if (
    /retarget|warm|engaged|nurture|remarket/.test(name) ||
    /engaged|warm|retarget|remarket/.test(aud)
  ) {
    return "retarget";
  }
  return "primary";
}

function adaptCampaignsToOffer(matched: any, snapshot: any) {
  const primaryObjective = detectPrimaryObjective(snapshot);
  const offerName: string =
    snapshot?.selected_offer?.name ||
    snapshot?.offers?.[0]?.name ||
    snapshot?.offer_hint ||
    "your offer";
  const campaigns = Array.isArray(matched?.campaigns)
    ? matched.campaigns.slice()
    : [];

  const rewritten = campaigns.map((c: any) => {
    const role = classifyRole(c);
    if (role === "awareness") {
      // Every OTHER role gets its name/creative_brief rewritten below — awareness
      // was the one gap left holding the matched template's raw, sometimes
      // industry-specific example content (e.g. "newly-engaged couples"), which
      // rendered straight to users in the campaign list. Give it the same
      // treatment: a safe, objective-aligned name/brief, never the template's
      // original wording.
      return {
        ...c,
        name: "Cold traffic (awareness)",
        creative_brief:
          `Introduce ${offerName} to a cold, broad audience with the strongest hook or proof point available — ` +
          `no hard ask yet, just earn the click/save/follow that feeds the next campaign.`,
      };
    }

    if (role === "primary") {
      if (primaryObjective === "OUTCOME_LEADS") {
        return {
          ...c,
          name: "Lead generation (primary)",
          objective: "OUTCOME_LEADS",
          creative_brief:
            `Direct invitation to sign up for ${offerName}. Lead with the outcome they get by registering, ` +
            `one clear benefit, and a single CTA to the opt-in / registration page. Use an instant lead form if it fits, ` +
            `otherwise drive to the registration landing page.`,
        };
      }
      if (primaryObjective === "OUTCOME_AWARENESS") {
        return { ...c, name: "Awareness (primary)", objective: "OUTCOME_AWARENESS" };
      }
      return { ...c, objective: "OUTCOME_SALES" };
    }

    // Retarget: align with whatever the primary objective is.
    if (primaryObjective === "OUTCOME_LEADS") {
      return {
        ...c,
        name: "Warm retargeting (sign-ups)",
        objective: "OUTCOME_LEADS",
        creative_brief:
          `Re-invite warm viewers/visitors who haven't signed up yet for ${offerName}. ` +
          `Handle the top 1-2 objections (time, "is this for me?", trust), then a clear CTA to register.`,
      };
    }
    if (primaryObjective === "OUTCOME_AWARENESS") {
      return { ...c, objective: "OUTCOME_AWARENESS" };
    }
    return { ...c, objective: "OUTCOME_SALES" };
  });

  return { ...matched, campaigns: rewritten };
}
