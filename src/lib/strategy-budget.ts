// Strategy budget math — sizes a multi-campaign funnel around a single
// "main" conversion campaign (the only one that's required) plus optional
// supplemental campaigns (top-of-funnel + retargeting) that lift results
// at a small fraction of the main spend.

import { getLumiKPIConfig } from "./lumi-kpi-config";

export type CampaignTier = "main" | "supplemental";

export type BudgetCampaignInput = {
  name?: string;
  objective?: string;
  goal?: string;
  audience?: string;
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
};

export function parsePricePoint(price?: string | null): number | null {
  if (!price) return null;
  const matches = String(price).replace(/,/g, "").match(/\d+(\.\d+)?/g);
  if (!matches?.length) return null;
  const n = Math.max(...matches.map(Number).filter((value) => isFinite(value)));
  return isFinite(n) && n > 0 ? n : null;
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

function supplementalDailyFor(mainDaily: number, stageIdeal: number) {
  const target = Math.max(
    SUPPLEMENTAL_MIN_DAILY,
    Math.round(mainDaily * SUPPLEMENTAL_PCT),
  );
  const cap = Math.max(SUPPLEMENTAL_MIN_DAILY, Math.round(mainDaily * SUPPLEMENTAL_MAX_PCT));
  return Math.min(stageIdeal, Math.min(cap, target));
}

export function computeStrategyBudget(
  input: StrategyBudgetInput,
): StrategyBudgetResult {
  const price = parsePricePoint(input.pricePoint);
  const campaigns = input.campaigns || [];

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

  // Order: main first (by priority), supplemental after.
  const ordered = [...enriched].sort((a, b) => {
    if (a.role.tier !== b.role.tier) return a.role.tier === "main" ? -1 : 1;
    return a.role.priority - b.role.priority || a._i - b._i;
  });

  // The first main campaign is "the" main — the only required one.
  const primaryMainIdx = ordered.findIndex((s) => s.role.tier === "main");

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
    tier: s.role.tier,
    required: idx === primaryMainIdx,
  }));

  // Range totals: main(s) at lean/ideal + supplemental at ~15% of main ideal.
  const mainStages = stages.filter((s) => s.tier === "main");
  const supplementalStages = stages.filter((s) => s.tier === "supplemental");
  const primaryMain = stages[primaryMainIdx] ?? null;
  const primaryMainIdeal = primaryMain?.idealDaily ?? 0;
  const primaryMainLean = primaryMain?.leanDaily ?? 0;

  const supplementalLeanTotal = supplementalStages.reduce(
    (s, x) => s + supplementalDailyFor(primaryMainLean, x.leanDaily),
    0,
  );
  const supplementalIdealTotal = supplementalStages.reduce(
    (s, x) => s + supplementalDailyFor(primaryMainIdeal, x.idealDaily),
    0,
  );
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

    // 1. Fund the primary main first — ideal, then fall back to lean.
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

    // 3. Layer in supplemental at ~15% of primary main spend.
    const primarySpend = primary?.dailyBudget ?? 0;
    for (const s of stages) {
      if (s.tier !== "supplemental") continue;
      const target = supplementalDailyFor(primarySpend, s.idealDaily);
      if (target > 0 && remaining >= target) {
        s.included = true;
        s.dailyBudget = target;
        remaining -= target;
      }
    }

    // 4. Push leftover (>$1/day) into the primary main.
    if (remaining >= 1 && primary?.included) {
      primary.dailyBudget += Math.floor(remaining);
    }

    const included = stages.filter((s) => s.included);
    const mainIncluded = included.filter((s) => s.tier === "main");
    const supplementalIncluded = included.filter((s) => s.tier === "supplemental");

    if (!primary || !primary.included) {
      const need = primary?.leanDaily ?? 0;
      warning = primary
        ? `Your main ${primary.roleLabel.toLowerCase()} campaign needs at least $${need}/day to give Meta enough data — at $${Math.round(dailyCap)}/day it can't run.`
        : `This funnel has no main conversion campaign to fund.`;
      rationale = `Your budget can't yet cover the required main campaign.`;
    } else {
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
