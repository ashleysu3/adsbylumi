// ============================================================================
// recommend-strategy — needs-first routing tests
//
// These tests don't hit the AI matcher or the database. They exercise the pure
// decision logic — "what is the simplest single campaign that can work for this
// offer?" — against hand-built brand snapshots.
//
// Run via:
//   deno test --no-check --allow-env \
//     supabase/functions/recommend-strategy/index.test.ts
//
// (--no-check because several edge functions in this repo don't type-check
// standalone; the logic under test is checked by `deno check` on index.ts.)
//
// The rule these lock down: LUMI recommends ONE campaign at 100% of budget, and
// never an awareness campaign. Both are easy to regress silently — a stray
// template or a "helpful" extra campaign costs a real user real money before
// anyone notices.
// ============================================================================

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Importing index.ts would start the HTTP server; stub it out first, then load
// the module dynamically so the stub is in place before the top-level call.
(Deno as unknown as { serve: () => unknown }).serve = () => ({
  finished: Promise.resolve(),
  shutdown: () => {},
});
const { __test_exports } = await import("./index.ts");
const { detectPrimaryObjective, buildNeedsFirstStrategy } = __test_exports;

/** The 3-campaign template that used to dictate everyone's structure. */
const THREE_STEP_TEMPLATE = {
  slug: "coach-course-creator-3step",
  name: "Coach / Course Creator — 3 step",
  campaigns: [
    { name: "Educational awareness (top of funnel)", objective: "OUTCOME_AWARENESS", budget_pct: 40 },
    { name: "Cold conversion", objective: "OUTCOME_SALES", budget_pct: 40, audience: "Broad+" },
    { name: "Warm retargeting", objective: "OUTCOME_SALES", budget_pct: 20, audience: "Engaged 30 days" },
  ],
};

const snapshot = (over: Record<string, unknown> = {}) => ({
  brand: { name: "Test Brand" },
  offers: [],
  selected_offer: null,
  user_goal: null,
  offer_hint: null,
  ...over,
});

// --- objective routing ------------------------------------------------------

Deno.test("a free lead magnet routes to LEADS", () => {
  const s = snapshot({ selected_offer: { name: "Free Guide", page_goal: "free_resource" } });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_LEADS");
});

Deno.test("a free email-capture offer without page_goal still routes to LEADS", () => {
  const s = snapshot({
    selected_offer: {
      name: "Free Starter Kit",
      price_point: "Free",
      description: "Sign up with your email to get the starter kit.",
      page_goal: "other",
    },
  });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_LEADS");
});

Deno.test("a free download that mentions email in target_outcome routes to LEADS", () => {
  const s = snapshot({
    selected_offer: {
      name: "Quick Wins Checklist",
      price_point: "$0",
      target_outcome: "Collect email addresses for the newsletter",
      page_goal: "other",
    },
  });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_LEADS");
});

Deno.test("a free offer is never a sales campaign", () => {
  const s = snapshot({
    selected_offer: {
      name: "Free Community Access",
      price_point: "free",
      description: "Join our free community.",
      page_goal: "other",
    },
  });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_LEADS");
});

Deno.test("a discovery call routes to LEADS", () => {
  const s = snapshot({ selected_offer: { name: "Strategy Call", page_goal: "discovery_call" } });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_LEADS");
});

Deno.test("a paid offer routes to SALES", () => {
  const s = snapshot({ selected_offer: { name: "The Program", page_goal: "purchase", price_point: "$997" } });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_SALES");
});

Deno.test("'more followers' routes to TRAFFIC, never AWARENESS", () => {
  const s = snapshot({ user_goal: "grow_social" });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_TRAFFIC");
});

Deno.test("'more DMs' routes to ENGAGEMENT (conversations)", () => {
  const s = snapshot({ user_goal: "dm_leads" });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_ENGAGEMENT");
});

Deno.test("awareness-shaped language still routes to TRAFFIC, not AWARENESS", () => {
  const s = snapshot({ offer_hint: "I just want brand awareness and to grow my account" });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_TRAFFIC");
});

// --- structure --------------------------------------------------------------

Deno.test("the 3-campaign template collapses to ONE campaign at 100% budget", () => {
  const s = snapshot({ selected_offer: { name: "Free Guide", page_goal: "free_resource" } });
  const out = buildNeedsFirstStrategy(THREE_STEP_TEMPLATE, s);

  assertEquals(out.campaigns.length, 1);
  assertEquals(out.campaigns[0].budget_pct, 100);
  assertEquals(out.campaigns[0].objective, "OUTCOME_LEADS");
});

Deno.test("no campaign shape ever emits an awareness objective", () => {
  const cases = [
    snapshot({ selected_offer: { name: "Free Guide", page_goal: "free_resource" } }),
    snapshot({ selected_offer: { name: "The Program", page_goal: "purchase" } }),
    snapshot({ user_goal: "grow_social" }),
    snapshot({ user_goal: "dm_leads" }),
  ];
  for (const s of cases) {
    const out = buildNeedsFirstStrategy(THREE_STEP_TEMPLATE, s);
    for (const c of out.campaigns) {
      assertEquals(c.objective === "OUTCOME_AWARENESS", false);
    }
    assertEquals(out.objective === "OUTCOME_AWARENESS", false);
  }
});

Deno.test("a followers campaign carries the Instagram profile destination", () => {
  const out = buildNeedsFirstStrategy(THREE_STEP_TEMPLATE, snapshot({ user_goal: "grow_social" }));
  const c = out.campaigns[0];

  assertEquals(c.objective, "OUTCOME_TRAFFIC");
  assertEquals(c.optimization_event, "PROFILE_VISITS");
  assertEquals(c.destination, "INSTAGRAM_PROFILE");
  // build-meta-campaign resolves this off the top level of strategy_json.
  assertEquals(out.optimization_event, "PROFILE_VISITS");
});

Deno.test("the retargeting campaign from the template is dropped, not rebranded", () => {
  const out = buildNeedsFirstStrategy(THREE_STEP_TEMPLATE, snapshot({
    selected_offer: { name: "The Program", page_goal: "purchase" },
  }));
  const names = out.campaigns.map((c: { name: string }) => c.name.toLowerCase());
  assertEquals(names.some((n: string) => n.includes("retarget")), false);
  assertEquals(names.some((n: string) => n.includes("warm")), false);
});

Deno.test("every campaign can explain itself (for the 'teach the why' layer)", () => {
  const out = buildNeedsFirstStrategy(THREE_STEP_TEMPLATE, snapshot({ user_goal: "grow_social" }));
  const why = out.campaigns[0].why as string;
  assertEquals(typeof why === "string" && why.length > 40, true);
});

Deno.test("a free webinar titled only by its promise routes to LEADS", () => {
  const s = snapshot({
    selected_offer: {
      name: "How to start a wedding planning business this year... and book your first 5 clients",
      price_point: "Free",
      offer_type: "webinar",
      page_goal: "other",
    },
  });
  assertEquals(detectPrimaryObjective(s), "OUTCOME_LEADS");
});
