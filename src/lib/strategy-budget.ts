// Strategy budget math — sizes a multi-campaign funnel around a single
// "main" conversion campaign (the only one that's required) plus optional
// supplemental campaigns (top-of-funnel + retargeting) that lift results
// at a small fraction of the main spend.
//
// The brand's business-model archetype (see business-archetypes.ts) sets
// the FLOOR for the main campaign's daily spend, the retargeting multiplier
// (ecommerce runs warm at 2-3× cold instead of 15%), and an advisory note
// for launch-window-only models (community/membership).

import { getLumiKPIConfig } from "./lumi-kpi-config";
import { getArchetype, type ArchetypeSlug } from "./business-archetypes";

export type CampaignTier = "main" | "supplemental";

export type BudgetSuggestion = string | { min?: number; max?: number } | null | undefined;

export type BudgetCampaignInput = {
  name?: string;
  objective?: string;
  goal?: string;
  audience?: string;
  // Optional per-campaign budget floor coming from a strategy template's
  // `budget_suggestion` field (e.g. "$20–60/day cold" or { min: 20, max: 60 }).
  // When present, sets the lean/ideal floors so the template's recommendation
  // beats the generic KPI-based default.
  budgetSuggestion?: BudgetSuggestion;
};

export type StageBudget = {
  name: string;
  objective: string;
  kpiLabel: string;
  kpiPrimary: string;
  targetCostPerResult: number;
  idealDaily: number;
  leanDaily: number;
  included: boolean;
  dailyBudget: number;
  roleLabel: string;
  roleDescription: string;
  tier: CampaignTier;
  required: boolean;
};

export type StrategyBudgetResult = {
  stages: StageBudget[];
  totalDaily: number;
  totalMonthly: number;
  leanTotalDaily: number;
  idealTotalDaily: number;
  mainDaily: number;
  supplementalDaily: number;
  mode: "monthly_budget" | "goal" | "range";
  warning?: string;
  rationale: string;
  requiredDailyForGoal?: number;
};

export type StrategyBudgetInput = {
  campaigns: BudgetCampaignInput[];
  pricePoint?: string | null;
  monthlyBudget?: number | null;
  goalCount?: number | null;
  // Brand's business-model archetype (lead_gen_funnels, low_ticket_direct,
  // high_ticket_consult, ecommerce, community_membership). When present, the
  // archetype's test-daily range sets the floor for the primary main campaign,
  // the retarget multiplier (ecommerce) reshapes supplemental allocation, and
  // launch-window models surface a launch-only advisory in the rationale.
  archetypeSlug?: ArchetypeSlug | string | null;
};

export function parsePricePoint(price?: string | null): number | null {
  if (!price) return null;
  const matches = String(price).replace(/,/g, "").match(/\d+(\.\d+)?/g);
  if (!matches?.length) return null;
  const n = Math.max(...matches.map(Number).filter((value) => isFinite(value)));
  return isFinite(n) && n > 0 ? n : null;
}

export function parseBudgetSuggestion(
  suggestion: BudgetSuggestion,
): { min: number; max: number } | null {
  if (!suggestion) return null;
  if (typeof suggestion === "object") {
    const min = Number(suggestion.min);
    const max = Number(suggestion.max);
    if (isFinite(min) && isFinite(max) && min > 0 && max >= min) return { min, max };
    if (isFinite(max) && max > 0) return { min: max, max };
    if (isFinite(min) && min > 0) return { min, max: min };
    return null;
  }
  // Parse strings like "$20–60/day", "$20-60/day", "$40/day", "20 to 60 per day"
  const s = String(suggestion).replace(/,/g, "").replace(/\u2013|\u2014/g, "-");
  // First numeric range in the string is treated as the suggested daily floor.
  const range = s.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:-|to)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (isFinite(min) && isFinite(max) && min > 0 && max >= min) return { min, max };
  }
  const single = s.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (single) {
    const n = Number(single[1]);
    if (isFinite(n) && n > 0) return { min: n, max: n };
  }
  return null;
}

function targetCostForCampaign(
  objective: string | undefined,
  name: string | undefined,
  pricePoint: number | null,
): { cost: number; kpiLabel: string; kpiPrimary: string } {
  const cfg = getLumiKPIConfig(objective, undefined, name);
  let cost = cfg.benchmark.max;
  if (cfg.primary === "roas") {
    const price = pricePoint ?? 50;
    cost = Math.min(Math.max(price * 0.5, 20), price);
  }
  return { cost, kpiLabel: cfg.primaryLabel, kpiPrimary: cfg.primary };
}

type RoleInfo = {
  roleLabel: string;
  roleDescription: string;
  priority: number;
  tier: CampaignTier;
};

function classifyRole(objective?: string, name?: string): RoleInfo {
  const o = (objective || "").toUpperCase();
  const n = (name || "").toLowerCase();

  if (n.includes("warm") || n.includes("retarget")) {
    return {
      roleLabel: "Warm retargeting",
      roleDescription: "closes people you already touched",
      priority: 3,
      tier: "supplemental",
    };
  }
  if (
    o.includes("LEAD") ||
    n.includes("lead") ||
    n.includes("training") ||
    n.includes("webinar") ||
    n.includes("opt-in") ||
    n.includes("opt in")
  ) {
    return {
      roleLabel: "Free training / lead capture",
      roleDescription: "cold → builds belief and gets opt-ins",
      priority: 1,
      tier: "main",
    };
  }
  if (
    o.includes("SALES") ||
    o.includes("CONVERSION") ||
    n.includes("sale") ||
    n.includes("purchase") ||
    n.includes("conversion")
  ) {
    return {
      roleLabel: "Cold conversion",
      roleDescription: "sells to people who self-identify as ready",
      priority: 2,
      tier: "main",
    };
  }
  if (
    o.includes("AWARENESS") ||
    o.includes("REACH") ||
    n.includes("aware") ||
    n.includes("grow")
  ) {
    return {
      roleLabel: "Awareness",
      roleDescription: "warms a cold audience for the main campaign",
      priority: 1,
      tier: "supplemental",
    };
  }
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICKS") || n.includes("traffic")) {
    return {
      roleLabel: "Traffic",
      roleDescription: "drives clicks to seed a retargeting pool",
      priority: 2,
      tier: "supplemental",
    };
  }
  if (o.includes("ENGAGEMENT") || n.includes("engagement")) {
    return {
      roleLabel: "Engagement",
      roleDescription: "warms cold audiences for retargeting",
      priority: 2,
      tier: "supplemental",
    };
  }
  return {
    roleLabel: name || "Campaign",
    roleDescription: "",
    priority: 2,
    tier: "main",
  };
}

// Meta needs ~25 conversions/week per ad set to exit learning.
const RESULTS_PER_WEEK_IDEAL = 25;
const RESULTS_PER_WEEK_LEAN = 15;

// Supplemental campaigns ride at ~15% of the main daily spend, with a
// floor that still produces meaningful reach and a cap so they never
// dwarf the main campaign.
const SUPPLEMENTAL_PCT = 0.15;
const SUPPLEMENTAL_MIN_DAILY = 5;
const SUPPLEMENTAL_MAX_PCT = 0.25;

function allocateSupplementalBudgets<T extends { leanDaily: number; idealDaily: number }>(
  mainDaily: number,
  supplementalStages: T[],
  targetKey: "leanDaily" | "idealDaily",
  // Archetype override: ecommerce runs retargeting at 2-3× cold spend,
  // not 15%. When set, the cap and per-stage target use the multiplier
  // range (min for per-stage, max for total cap).
  override?: { perStagePct?: number; totalCapPct?: number },
) {
  const perStagePct = override?.perStagePct ?? SUPPLEMENTAL_PCT;
  const totalCapPct = override?.totalCapPct ?? SUPPLEMENTAL_MAX_PCT;
  let remainingSupplementalCap = Math.floor(mainDaily * totalCapPct);
  return supplementalStages.map((stage) => {
    const target = Math.min(
      stage[targetKey],
      Math.max(SUPPLEMENTAL_MIN_DAILY, Math.round(mainDaily * perStagePct)),
    );
    const amount = Math.min(target, remainingSupplementalCap);
    if (amount < SUPPLEMENTAL_MIN_DAILY) return 0;
    remainingSupplementalCap -= amount;
    return amount;
  });
}

export function computeStrategyBudget(
  input: StrategyBudgetInput,
): StrategyBudgetResult {
  const price = parsePricePoint(input.pricePoint);
  const campaigns = input.campaigns || [];
  const archetype = getArchetype(input.archetypeSlug ?? null);
  const archetypeSupplementalOverride = archetype?.budgetApproach.retargetMultiplier
    ? {
        // Per-stage warm spend = min multiplier × main; total cap = max × main.
        perStagePct: archetype.budgetApproach.retargetMultiplier.min,
        totalCapPct: archetype.budgetApproach.retargetMultiplier.max,
      }
    : undefined;

  const enriched = campaigns.map((c, i) => {
    const { cost, kpiLabel, kpiPrimary } = targetCostForCampaign(
      c.objective,
      c.name,
      price,
    );
    let idealDaily = Math.max(1, Math.round((RESULTS_PER_WEEK_IDEAL * cost) / 7));
    let leanDaily = Math.max(1, Math.round((RESULTS_PER_WEEK_LEAN * cost) / 7));
    const role = classifyRole(c.objective, c.name);

    // Cold sales floor: a cold sales campaign must run at least the
    // offer price ÷ 2 daily or Meta can't reliably buy a sale.
    if (role.roleLabel === "Cold conversion" && price) {
      const floor = Math.ceil(price * 0.5);
      leanDaily = floor;
      idealDaily = Math.max(idealDaily, floor);
    }

    // Template-driven floor: a strategy template's budget_suggestion overrides
    // the generic KPI-derived default so the recommended range wins.
    const tpl = parseBudgetSuggestion(c.budgetSuggestion);
    if (tpl) {
      leanDaily = Math.max(leanDaily, tpl.min);
      idealDaily = Math.max(idealDaily, tpl.max);
    }

    return {
      _i: i,
      name: c.name || role.roleLabel,
      objective: c.objective || "",
      kpiLabel,
      kpiPrimary,
      targetCostPerResult: cost,
      idealDaily,
      leanDaily,
      role,
    };
  });

  // Pick the required main before ordering: cold sales wins when present;
  // otherwise use the first main-stage campaign.
  const coldSalesSourceIdx = enriched.findIndex((s) => s.role.roleLabel === "Cold conversion");
  const firstMainSourceIdx = enriched.findIndex((s) => s.role.tier === "main");
  const primarySourceIdx =
    coldSalesSourceIdx >= 0
      ? coldSalesSourceIdx
      : firstMainSourceIdx >= 0
        ? firstMainSourceIdx
        : 0;

  // Order: required main first, then optional layers.
  const ordered = [...enriched].sort((a, b) => {
    if (a._i === primarySourceIdx) return -1;
    if (b._i === primarySourceIdx) return 1;
    if (a.role.tier !== b.role.tier) return a.role.tier === "main" ? -1 : 1;
    return a.role.priority - b.role.priority || a._i - b._i;
  });

  // Every non-primary campaign becomes supplemental, even if its objective can
  // technically optimize.
  const primaryMainIdx = 0;

  let stages: StageBudget[] = ordered.map((s, idx) => ({
    name: s.name,
    objective: s.objective,
    kpiLabel: s.kpiLabel,
    kpiPrimary: s.kpiPrimary,
    targetCostPerResult: s.targetCostPerResult,
    idealDaily: s.idealDaily,
    leanDaily: s.leanDaily,
    included: true,
    dailyBudget: s.idealDaily,
    roleLabel: s.role.roleLabel,
    roleDescription: s.role.roleDescription,
    tier: idx === primaryMainIdx ? "main" : "supplemental",
    required: idx === primaryMainIdx,
  }));

  // Archetype floor on the primary main: the brand's business model sets
  // a test-daily range that beats the KPI-derived default (template-level
  // budget_suggestion already applied per-stage in `enriched`).
  if (archetype && stages[primaryMainIdx]) {
    const a = archetype.budgetApproach.testDaily;
    const main = stages[primaryMainIdx];
    main.leanDaily = Math.max(main.leanDaily, a.min);
    main.idealDaily = Math.max(main.idealDaily, a.max);
    main.dailyBudget = Math.max(main.dailyBudget, main.idealDaily);
  }

  // Range totals: main(s) at lean/ideal + supplemental at archetype-aware
  // share of main ideal (ecommerce: 2-3× cold; else ~15%).
  const mainStages = stages.filter((s) => s.tier === "main");
  const supplementalStages = stages.filter((s) => s.tier === "supplemental");
  const primaryMain = stages[primaryMainIdx] ?? null;
  const primaryMainIdeal = primaryMain?.idealDaily ?? 0;
  const primaryMainLean = primaryMain?.leanDaily ?? 0;

  const supplementalLeanTotal = allocateSupplementalBudgets(
    primaryMainLean,
    supplementalStages,
    "leanDaily",
    archetypeSupplementalOverride,
  ).reduce((s, x) => s + x, 0);
  const supplementalIdealTotal = allocateSupplementalBudgets(
    primaryMainIdeal,
    supplementalStages,
    "idealDaily",
    archetypeSupplementalOverride,
  ).reduce((s, x) => s + x, 0);
  const leanTotalDaily =
    mainStages.reduce((s, x) => s + x.leanDaily, 0) + supplementalLeanTotal;
  const idealTotalDaily =
    mainStages.reduce((s, x) => s + x.idealDaily, 0) + supplementalIdealTotal;

  let mode: StrategyBudgetResult["mode"] = "range";
  let warning: string | undefined;
  let rationale = "";
  let requiredDailyForGoal: number | undefined;

  if (input.monthlyBudget && input.monthlyBudget > 0 && stages.length > 0) {
    mode = "monthly_budget";
    const dailyCap = input.monthlyBudget / 30;

    stages = stages.map((s) => ({ ...s, included: false, dailyBudget: 0 }));
    let remaining = dailyCap;

    // 1. Fund the primary main first — ideal, then fall back to lean, then
    // whatever budget exists. The main campaign always gets the money first;
    // warnings explain if it is under the 25/week optimization target.
    const primary = stages[primaryMainIdx];
    if (primary) {
      if (remaining >= primary.idealDaily) {
        primary.included = true;
        primary.dailyBudget = primary.idealDaily;
        remaining -= primary.idealDaily;
      } else if (remaining >= primary.leanDaily) {
        primary.included = true;
        primary.dailyBudget = primary.leanDaily;
        remaining -= primary.leanDaily;
      } else if (remaining > 0) {
        primary.included = true;
        primary.dailyBudget = Math.floor(remaining) || remaining;
        remaining = 0;
      }
    }

    // 2. Fund secondary main campaigns (still important, but not required).
    for (const s of stages) {
      if (s === primary || s.tier !== "main") continue;
      if (remaining >= s.idealDaily) {
        s.included = true;
        s.dailyBudget = s.idealDaily;
        remaining -= s.idealDaily;
      } else if (remaining >= s.leanDaily) {
        s.included = true;
        s.dailyBudget = s.leanDaily;
        remaining -= s.leanDaily;
      }
    }

    // 3. Layer in supplemental at a small capped share of primary main spend.
    const primarySpend = primary?.dailyBudget ?? 0;
    const supplementalCandidates = stages.filter((s) => s.tier === "supplemental");
    const supplementalAllocations = allocateSupplementalBudgets(
      primarySpend,
      supplementalCandidates,
      "idealDaily",
      archetypeSupplementalOverride,
    );
    supplementalCandidates.forEach((s, index) => {
      const target = supplementalAllocations[index] ?? 0;
      if (target > 0 && remaining >= target) {
        s.included = true;
        s.dailyBudget = target;
        remaining -= target;
      }
    });

    // 4. Push leftover (>$1/day) into the primary main.
    if (remaining >= 1 && primary?.included) {
      primary.dailyBudget += Math.floor(remaining);
    }

    const included = stages.filter((s) => s.included);
    const mainIncluded = included.filter((s) => s.tier === "main");
    const supplementalIncluded = included.filter((s) => s.tier === "supplemental");

    if (!primary || !primary.included) {
      warning = `This funnel has no main conversion campaign to fund.`;
      rationale = `Your budget can't yet cover the required main campaign.`;
    } else {
      if (primary.dailyBudget < primary.leanDaily) {
        warning = `Your main ${primary.roleLabel.toLowerCase()} campaign is getting the budget first, but $${primary.dailyBudget}/day is below the $${primary.leanDaily}/day lean target and may not reach 25 conversions/week.`;
      }
      const supBits =
        supplementalIncluded.length > 0
          ? ` plus ${supplementalIncluded.length} supplemental ${supplementalIncluded.length === 1 ? "campaign" : "campaigns"} (~$${supplementalIncluded.reduce((s, x) => s + x.dailyBudget, 0)}/day) to lift results`
          : ` — supplemental campaigns are optional and can be added later`;
      rationale = `Your $${input.monthlyBudget}/mo (~$${Math.round(dailyCap)}/day) funds the main ${primary.roleLabel.toLowerCase()} campaign at $${primary.dailyBudget}/day${supBits}.`;
      if (mainIncluded.length < mainStages.length) {
        const skipped = mainStages.filter((s) => !s.included);
        rationale += ` The ${skipped.map((s) => s.roleLabel.toLowerCase()).join(" + ")} campaign${skipped.length > 1 ? "s aren't" : " isn't"} funded yet — add ${skipped.length > 1 ? "them" : "it"} once the main is humming.`;
      }
    }

    // Cold sales floor warning if the required main can't fit cold.
    const excludedColdSales = stages.find(
      (s) => !s.included && s.roleLabel === "Cold conversion" && s.required,
    );
    if (excludedColdSales && price) {
      const floor = Math.ceil(price * 0.5);
      const note = `Selling a $${price} offer cold needs at least $${floor}/day so Meta can actually buy a sale. If that's too much, lead with a free training, lead magnet, or challenge instead of selling cold — it's the right move at this budget, not a workaround.`;
      warning = warning ? `${warning} ${note}` : note;
    }
  } else if (input.goalCount && input.goalCount > 0 && stages.length > 0) {
    mode = "goal";
    const primary = stages[primaryMainIdx] ?? stages[0];
    requiredDailyForGoal = Math.max(
      primary.leanDaily,
      Math.round((input.goalCount * primary.targetCostPerResult) / 30),
    );
    stages = stages.map((s) => ({
      ...s,
      included: s === primary,
      dailyBudget: s === primary ? requiredDailyForGoal! : 0,
    }));
    rationale = `To hit ~${input.goalCount}/month you'll need about $${requiredDailyForGoal}/day on the main ${primary.roleLabel.toLowerCase()} campaign. Supplemental campaigns are optional and can be added later.`;
  } else {
    mode = "range";
    if (stages.length > 0 && primaryMain) {
      const mainRange =
        primaryMainLean === primaryMainIdeal
          ? `$${primaryMainIdeal}/day`
          : `$${primaryMainLean}–$${primaryMainIdeal}/day`;
      if (supplementalStages.length > 0) {
        rationale = `Main ${primaryMain.roleLabel.toLowerCase()} campaign needs ${mainRange}. Add about $${supplementalLeanTotal}–$${supplementalIdealTotal}/day for the supplemental layer to lift results — it's optional, not required. Total: $${leanTotalDaily}–$${idealTotalDaily}/day.`;
      } else {
        rationale = `This main campaign needs ${mainRange}. Enter your monthly budget or goal to tailor it.`;
      }
    } else {
      rationale = `Enter your monthly budget or a goal to size this campaign.`;
    }
  }

  const totalDaily = stages.reduce(
    (s, x) => s + (x.included ? x.dailyBudget : 0),
    0,
  );
  const totalMonthly = totalDaily * 30;
  const mainDaily = stages
    .filter((s) => s.tier === "main" && s.included)
    .reduce((s, x) => s + x.dailyBudget, 0);
  const supplementalDaily = stages
    .filter((s) => s.tier === "supplemental" && s.included)
    .reduce((s, x) => s + x.dailyBudget, 0);

  // Append archetype guidance to rationale so the budget panel surfaces
  // the brand's framework (scaling rule, launch-window-only, etc).
  if (archetype) {
    const launchNote = archetype.budgetApproach.launchWindowOnly
      ? ` ${archetype.label} model — run only during open-enrollment windows (2-4/year), not always-on.`
      : "";
    rationale = `${rationale}${launchNote} ${archetype.label} framework: ${archetype.budgetApproach.scalingRule}`.trim();
  }

  return {
    stages,
    totalDaily,
    totalMonthly,
    leanTotalDaily,
    idealTotalDaily,
    mainDaily,
    supplementalDaily,
    mode,
    warning,
    rationale,
    requiredDailyForGoal,
  };
}
