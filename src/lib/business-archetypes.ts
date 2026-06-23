// Business-model archetypes — the operating framework that sits ABOVE
// strategy templates. Each archetype sets the brand's budget approach,
// success metrics, and grading rules. Templates inherit from archetypes.
//
// This is a code-level config (not a DB table) because the 5 archetypes
// are global and rarely change. The user's selected archetype is stored
// on `brands.business_model`.

export type ArchetypeSlug =
  | "lead_gen_funnels"
  | "low_ticket_direct"
  | "high_ticket_consult"
  | "ecommerce"
  | "community_membership";

export type ArchetypeMetric = {
  // Stable key — also doubles as the KPI key when it matches `KPI_OPTIONS`
  // (cpl, roas, cpc, etc.). Custom keys (opt_in_rate, show_up_rate) are
  // advisory — they live in the strategy/results UI, not Meta's KPI dropdown.
  key: string;
  label: string;
  // Plain-language target (e.g. "3-5%", "≥1:3", "$50-200"). Strings, not
  // numbers, because each archetype's targets are ranges + rules of thumb.
  target: string;
  isPrimary?: boolean;
  // Optional mapping to a row in `goal-suggestions.KPI_OPTIONS` so we can
  // pre-fill GoalSetupModal. When null, this metric is advisory only.
  kpiKey?: string | null;
  // Numeric threshold default for the matched kpiKey (used in goal pre-fill).
  defaultThreshold?: number | null;
  goalType?: "less_than" | "greater_than";
};

export type ArchetypeBudgetApproach = {
  testDaily: { min: number; max: number };
  // Plain-language scaling rule shown to users in the budget rationale.
  scalingRule: string;
  // When set, supplemental retargeting spend scales to N× cold spend
  // (ecommerce) instead of the generic 15% rule.
  retargetMultiplier?: { min: number; max: number };
  // When true, the funnel only runs during open-enrollment windows
  // (community/membership). We surface that in the rationale and skip
  // always-on monthly projections.
  launchWindowOnly?: boolean;
  // Optional concrete trigger (e.g. "after ~50 conversions").
  scaleTrigger?: string;
};

// Creative cadence — how often to refresh creative, how many angles per
// test, and (for community launches) the narrative arc across the window.
// Surfaced in Creative Studio nudges and used by the fatigue engine to
// pick archetype-appropriate frequency thresholds.
export type ArchetypeCadence = {
  // Plain-language pace shown in the nudge ("Weekly rotation", "Slow").
  rotationPace: string;
  // How many distinct angles/variations to ship per test cycle.
  anglesPerTest: { min: number; max: number };
  // Days between scheduled refreshes (lower bound = "due soon" trigger).
  refreshEveryDays: { min: number; max: number };
  // Override fatigue threshold — frequency at which the evaluator should
  // call this audience fatigued. Low-ticket rotates sooner (lower threshold),
  // high-ticket tolerates more repetition. Falls back to the temp-based
  // default (warm=5, cold=3) when undefined.
  fatigueFrequencyThreshold?: { cold: number; warm: number };
  // For launch-window archetypes — the week-by-week narrative arc.
  narrativeArc?: string[];
  // One-line tip surfaced in the nudge body.
  tip: string;
};

export type Archetype = {
  slug: ArchetypeSlug;
  label: string;
  tagline: string;
  blurb: string;
  budgetApproach: ArchetypeBudgetApproach;
  successMetrics: ArchetypeMetric[];
  // Grading guidance the evaluate-campaign-status function surfaces so the
  // UI can override generic ROAS-led judgments where they don't apply.
  gradingNotes: string[];
  // Strategy template slugs that live under this archetype. Some are
  // intentionally empty (ecommerce) — the framework is seeded even if
  // templates come later.
  templateSlugs: string[];
  // Creative cadence — drives Studio nudges + fatigue thresholds.
  cadence: ArchetypeCadence;
};

export const ARCHETYPES: Record<ArchetypeSlug, Archetype> = {
  lead_gen_funnels: {
    slug: "lead_gen_funnels",
    label: "Lead Generation Funnel",
    tagline: "Webinar, challenge, lead magnet → nurture → sell",
    blurb:
      "You're building an email list and converting it through a free training or challenge. Success is judged on opt-ins, show-ups, and downstream LTV — not webinar ROAS.",
    budgetApproach: {
      testDaily: { min: 50, max: 300 },
      scalingRule:
        "Aim to fill ~50 live attendees. Optimize registrations + show-up first, conversion second. Scale +20% when CPL holds.",
      scaleTrigger: "consistent CPL + ~50 attendees",
    },
    successMetrics: [
      {
        key: "opt_in_rate",
        label: "Opt-in rate (landing page)",
        target: "3-5% is solid",
        isPrimary: true,
      },
      { key: "show_up_rate", label: "Webinar show-up rate", target: "18-20% good" },
      { key: "live_conversion", label: "Live conversion to offer", target: "15-25%" },
      {
        key: "cpl",
        label: "Cost per Lead",
        target: "track but don't grade alone",
        kpiKey: "cpl",
        defaultThreshold: 8,
        goalType: "less_than",
      },
      { key: "list_ltv", label: "LTV from list (90-day)", target: "primary read" },
    ],
    gradingNotes: [
      "Do NOT grade lead-gen campaigns on webinar ROAS alone — judge on opt-in / show-up / live-conversion and LTV from the list.",
      "Weak Day-1 ROAS is normal. The real read is downstream nurture revenue at 30/60/90 days.",
    ],
    templateSlugs: ["webinar-cold", "paid-challenge-cold", "lead-magnet-cold"],
    cadence: {
      rotationPace: "Weekly rotation",
      anglesPerTest: { min: 3, max: 5 },
      refreshEveryDays: { min: 7, max: 14 },
      fatigueFrequencyThreshold: { cold: 3, warm: 5 },
      tip: "Ship 3–5 angles, refresh every 1–2 weeks. Hooks fatigue fast on cold lead-gen.",
    },
  },

  low_ticket_direct: {
    slug: "low_ticket_direct",
    label: "Low-Ticket Direct Sales",
    tagline: "$27-97 impulse offers, sold direct from ad",
    blurb:
      "Impulse-priced products sold direct. Test small, find a profitable cost-per-purchase, then scale. Repeat purchase rate matters more than first-sale margin.",
    budgetApproach: {
      testDaily: { min: 5, max: 50 },
      scalingRule:
        "Run cheap until ~50 conversions show a consistent cost per purchase. Then scale +20% per week while ROAS holds.",
      scaleTrigger: "~50 consistent conversions",
    },
    successMetrics: [
      {
        key: "cost_per_purchase",
        label: "Cost per Purchase",
        target: "≥ 1:3 ROAS",
        isPrimary: true,
        kpiKey: "roas",
        defaultThreshold: 3,
        goalType: "greater_than",
      },
      { key: "conversion_rate", label: "Landing-page conversion rate", target: "2-5%" },
      { key: "repeat_rate", label: "Repeat purchase rate (90-day)", target: "track for true ROAS" },
    ],
    gradingNotes: [
      "Don't kill an ad before ~50 conversions — small budgets need patience.",
      "Repeat purchase rate is the real margin lever, not first-sale ROAS.",
    ],
    templateSlugs: ["paid-challenge-cold", "low-ticket-offer"],
    cadence: {
      rotationPace: "High rotation",
      anglesPerTest: { min: 8, max: 12 },
      refreshEveryDays: { min: 5, max: 10 },
      fatigueFrequencyThreshold: { cold: 2.5, warm: 4 },
      tip: "Ship 8–12 variations weekly. Impulse buyers burn through hooks fast — rotate before frequency hits 3.",
    },
  },

  high_ticket_consult: {
    slug: "high_ticket_consult",
    label: "High-Ticket Consultation",
    tagline: "$2k-10k+ via application or booked call",
    blurb:
      "Application + sales call funnels. This isn't a volume game — a few qualified applications per week is the goal. Judge on application→call→close, not raw lead cost.",
    budgetApproach: {
      testDaily: { min: 100, max: 300 },
      scalingRule:
        "Budget scales with market size, not with cost-per-lead. A few qualified apps/week beats a flood of cheap leads.",
      scaleTrigger: "qualified application volume holding",
    },
    successMetrics: [
      {
        key: "cost_per_application",
        label: "Cost per Application",
        target: "varies — 5-15% of offer price",
        isPrimary: true,
        kpiKey: "cpl",
        defaultThreshold: 150,
        goalType: "less_than",
      },
      { key: "app_to_call_rate", label: "Application → Call rate", target: "40%+ good" },
      { key: "call_to_close_rate", label: "Call → Close rate", target: "20-30%" },
    ],
    gradingNotes: [
      "Don't grade on raw CPL — a $300 application that closes at $5k is a win.",
      "If app-to-call is below 30%, the qualifier is too loose, not the ad.",
    ],
    templateSlugs: ["dm-conversations", "application-booked-call"],
    cadence: {
      rotationPace: "Slow rotation",
      anglesPerTest: { min: 2, max: 4 },
      refreshEveryDays: { min: 14, max: 21 },
      fatigueFrequencyThreshold: { cold: 4, warm: 7 },
      tip: "Quality over quantity. Refresh every 2–3 weeks — high-ticket buyers need repetition to convert.",
    },
  },

  ecommerce: {
    slug: "ecommerce",
    label: "E-Commerce",
    tagline: "Catalog products, retargeting-heavy",
    blurb:
      "Physical or digital catalog products. Cold acquires; retargeting closes. Once pixel data is solid, retargeting carries 2-3× the cold spend.",
    budgetApproach: {
      testDaily: { min: 20, max: 100 },
      scalingRule:
        "Start cold at $20-100/day. Once pixel + catalog data exists, scale retargeting to 2-3× cold spend.",
      retargetMultiplier: { min: 2, max: 3 },
      scaleTrigger: "pixel data + 50+ purchases",
    },
    successMetrics: [
      {
        key: "roas",
        label: "ROAS",
        target: "≥ 2:1 blended",
        isPrimary: true,
        kpiKey: "roas",
        defaultThreshold: 2,
        goalType: "greater_than",
      },
      { key: "cac", label: "Customer Acquisition Cost", target: "< 50% of AOV" },
      { key: "repeat_rate", label: "Repeat customer rate", target: "30%+ for healthy LTV" },
    ],
    gradingNotes: [
      "Judge cold and retargeting separately — blended ROAS hides which layer is failing.",
      "Repeat customer rate compounds — a 2:1 first-purchase ROAS becomes 4:1 with repeats.",
    ],
    templateSlugs: [],
    cadence: {
      rotationPace: "Monthly refresh",
      anglesPerTest: { min: 5, max: 10 },
      refreshEveryDays: { min: 21, max: 30 },
      fatigueFrequencyThreshold: { cold: 3.5, warm: 8 },
      tip: "Plan 5–10 angles per product line. Retargeting tolerates much higher frequency than cold.",
    },
  },

  community_membership: {
    slug: "community_membership",
    label: "Community / Membership",
    tagline: "Recurring revenue, 2-4 launches per year",
    blurb:
      "Membership and community offers. Spend hard during open-enrollment windows, then go quiet. Judge on cost-per-member and retention, not first-month MRR.",
    budgetApproach: {
      testDaily: { min: 50, max: 200 },
      launchWindowOnly: true,
      scalingRule:
        "Run hard during open-enrollment windows only (2-4 per year). Don't run always-on — it teaches Meta the wrong audience and inflates cost-per-member.",
      scaleTrigger: "cohort fill pacing",
    },
    successMetrics: [
      {
        key: "cost_per_member",
        label: "Cost per Member",
        target: "track against 12-month LTV",
        isPrimary: true,
        kpiKey: "cpl",
        defaultThreshold: 80,
        goalType: "less_than",
      },
      { key: "cohort_fill_rate", label: "Cohort fill rate", target: "% of cap reached" },
      { key: "retention", label: "90-day retention", target: "≥ 70% healthy" },
      { key: "churn", label: "Monthly churn", target: "< 8% steady-state" },
    ],
    gradingNotes: [
      "Cost-per-member only makes sense when judged against LTV — a $200 member at $50/mo for a year is fine.",
      "Outside an enrollment window? Don't grade — pause and wait.",
    ],
    templateSlugs: ["launch-window-membership"],
    cadence: {
      rotationPace: "Launch-window narrative arc",
      anglesPerTest: { min: 4, max: 6 },
      refreshEveryDays: { min: 7, max: 7 },
      fatigueFrequencyThreshold: { cold: 4, warm: 8 },
      narrativeArc: [
        "Wk 1 — Problem / awareness",
        "Wk 2 — Community / belonging",
        "Wk 3 — Social proof / transformation",
        "Wk 4 — Urgency / doors closing",
      ],
      tip: "Run a 4-week narrative arc across the launch window — one creative theme per week.",
    },
  },
};

export const ARCHETYPE_LIST: Archetype[] = Object.values(ARCHETYPES);

export function getArchetype(slug: string | null | undefined): Archetype | null {
  if (!slug) return null;
  return (ARCHETYPES as Record<string, Archetype>)[slug] ?? null;
}

export type DiagnosisInput = {
  pricePoint?: string | number | null;
  offerType?: string | null;
  goal?: string | null;
  offerName?: string | null;
};

export type DiagnosisResult = {
  slug: ArchetypeSlug;
  confidence: "high" | "medium" | "low";
  reason: string;
};

function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return isFinite(raw) && raw > 0 ? raw : null;
  const m = String(raw).replace(/,/g, "").match(/\d+(\.\d+)?/g);
  if (!m?.length) return null;
  const n = Math.max(...m.map(Number).filter((v) => isFinite(v)));
  return n > 0 ? n : null;
}

// Heuristic diagnosis from the offer + goal. Each rule adds a confidence
// tier; the highest-scoring archetype wins. Tied or unsure cases fall back
// to lead_gen_funnels (the most common starting point for our audience).
export function diagnoseArchetype(input: DiagnosisInput): DiagnosisResult {
  const price = parsePrice(input.pricePoint);
  const offerType = (input.offerType || "").toLowerCase();
  const goal = (input.goal || "").toLowerCase();
  const name = (input.offerName || "").toLowerCase();

  const blob = `${offerType} ${goal} ${name}`;

  // Community / membership signals first — recurring + community keywords.
  if (
    /(member|membership|community|subscription|recurring|cohort|circle)/.test(blob)
  ) {
    return {
      slug: "community_membership",
      confidence: "high",
      reason: "Recurring/membership offer detected — open-enrollment framework applies.",
    };
  }

  // High-ticket: explicit price or call/application keywords.
  if (
    (price != null && price >= 2000) ||
    /(application|booked call|discovery call|consult|1:1|coaching call|mastermind|done-for-you|agency retainer)/.test(blob)
  ) {
    return {
      slug: "high_ticket_consult",
      confidence: price != null && price >= 2000 ? "high" : "medium",
      reason:
        price != null && price >= 2000
          ? `$${price} offer — application/call funnel beats raw lead volume.`
          : "Application or call-based offer — judge on app→call→close, not CPL.",
    };
  }

  // Ecommerce: physical/catalog/shop signals.
  if (/(shopify|store|catalog|sku|product|physical|shipping|ecom)/.test(blob)) {
    return {
      slug: "ecommerce",
      confidence: "high",
      reason: "Catalog/product offer — cold + retargeting at 2-3× cold spend.",
    };
  }

  // Lead-gen: webinar / challenge / lead-magnet language OR free price.
  if (
    /(webinar|training|challenge|workshop|masterclass|lead magnet|free guide|opt[- ]?in|email list|nurture)/.test(blob) ||
    (price != null && price === 0) ||
    /(lead|leads)/.test(goal)
  ) {
    return {
      slug: "lead_gen_funnels",
      confidence: "high",
      reason:
        "Free training / lead-magnet style — grade on opt-in, show-up, live conversion + LTV.",
    };
  }

  // Low-ticket direct: $27-97 impulse range.
  if (price != null && price >= 20 && price <= 100) {
    return {
      slug: "low_ticket_direct",
      confidence: "high",
      reason: `$${price} impulse offer — test small, scale once ~50 conversions hold.`,
    };
  }

  // $100-2000 → most often a webinar/challenge stepping stone in our audience.
  if (price != null && price > 100 && price < 2000) {
    return {
      slug: "lead_gen_funnels",
      confidence: "medium",
      reason: `Mid-ticket $${price} offer — usually best sold through a free training or challenge first.`,
    };
  }

  return {
    slug: "lead_gen_funnels",
    confidence: "low",
    reason: "Defaulting to Lead Generation — confirm or change if it doesn't fit.",
  };
}

// Convert an archetype's success metrics into KPI goal suggestions for
// the goal-setup modal. Only metrics with a `kpiKey` matching the dropdown
// options are returned. Primary first, then up to two more.
export function getArchetypeKpiSuggestions(slug: string | null | undefined): {
  primary: { kpi: string; threshold: number; goalType: "less_than" | "greater_than" } | null;
  secondary: { kpi: string; threshold: number; goalType: "less_than" | "greater_than" } | null;
  note: string;
} | null {
  const a = getArchetype(slug);
  if (!a) return null;
  const mapped = a.successMetrics
    .filter((m) => m.kpiKey && m.defaultThreshold != null && m.goalType)
    .map((m) => ({
      kpi: m.kpiKey as string,
      threshold: m.defaultThreshold as number,
      goalType: m.goalType as "less_than" | "greater_than",
      isPrimary: !!m.isPrimary,
    }));
  if (!mapped.length) return null;
  const primary = mapped.find((m) => m.isPrimary) ?? mapped[0];
  const secondary = mapped.find((m) => m !== primary) ?? null;
  const note = `${a.label} framework — ${a.gradingNotes[0] ?? a.tagline}`;
  return {
    primary: { kpi: primary.kpi, threshold: primary.threshold, goalType: primary.goalType },
    secondary: secondary
      ? { kpi: secondary.kpi, threshold: secondary.threshold, goalType: secondary.goalType }
      : null,
    note,
  };
}

// ---------------------------------------------------------------------------
// Creative cadence helpers — surfaced in Creative Studio + fatigue engine.
// ---------------------------------------------------------------------------

export function getArchetypeCadence(
  slug: string | null | undefined,
): ArchetypeCadence | null {
  const a = getArchetype(slug);
  return a?.cadence ?? null;
}

export type RefreshStatus =
  | { state: "no-archetype" }
  | { state: "never-refreshed"; tip: string }
  | { state: "fresh"; daysSince: number; daysUntilDue: number; tip: string }
  | { state: "due-soon"; daysSince: number; daysUntilDue: number; tip: string }
  | { state: "overdue"; daysSince: number; daysOverdue: number; tip: string };

/**
 * Compare the last refresh date against the archetype's cadence and return a
 * surfaced state for the Studio nudge.
 *
 * - fresh:     well within the refresh window
 * - due-soon:  inside the cadence min, but past 70%
 * - overdue:   past the cadence max
 */
export function getRefreshStatus(
  slug: string | null | undefined,
  lastRefreshAt: string | Date | null | undefined,
): RefreshStatus {
  const cadence = getArchetypeCadence(slug);
  if (!cadence) return { state: "no-archetype" };

  if (!lastRefreshAt) {
    return {
      state: "never-refreshed",
      tip: `No creative refreshes logged yet. ${cadence.tip}`,
    };
  }

  const last =
    lastRefreshAt instanceof Date ? lastRefreshAt : new Date(lastRefreshAt);
  if (isNaN(last.getTime())) return { state: "no-archetype" };

  const daysSince = Math.floor(
    (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24),
  );

  const { min, max } = cadence.refreshEveryDays;
  const dueSoonThreshold = Math.round(min * 0.7);

  if (daysSince >= max) {
    return {
      state: "overdue",
      daysSince,
      daysOverdue: daysSince - max,
      tip: `${cadence.rotationPace.toLowerCase()} is overdue. ${cadence.tip}`,
    };
  }
  if (daysSince >= dueSoonThreshold) {
    return {
      state: "due-soon",
      daysSince,
      daysUntilDue: Math.max(0, max - daysSince),
      tip: `Refresh window opens soon. ${cadence.tip}`,
    };
  }
  return {
    state: "fresh",
    daysSince,
    daysUntilDue: max - daysSince,
    tip: cadence.tip,
  };
}

/**
 * Suggested test size for a new round of creative — used by the Studio
 * "how many should I make?" nudge.
 */
export function getTestSizeSuggestion(slug: string | null | undefined): {
  min: number;
  max: number;
  label: string;
  pace: string;
} | null {
  const c = getArchetypeCadence(slug);
  if (!c) return null;
  return {
    min: c.anglesPerTest.min,
    max: c.anglesPerTest.max,
    label: `${c.anglesPerTest.min}–${c.anglesPerTest.max} angles per test`,
    pace: c.rotationPace,
  };
}

/**
 * Archetype-aware frequency threshold for the fatigue engine.
 * Falls back to the temp-based default when no override is configured.
 */
export function getFatigueFrequencyThreshold(
  slug: string | null | undefined,
  temp: "cold" | "warm",
): number {
  const c = getArchetypeCadence(slug);
  if (c?.fatigueFrequencyThreshold) {
    return temp === "warm"
      ? c.fatigueFrequencyThreshold.warm
      : c.fatigueFrequencyThreshold.cold;
  }
  // Default mirrors evaluate-campaign-status §6.4.
  return temp === "warm" ? 5 : 3;
}
