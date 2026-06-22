// Strategy budget math — sizes a 1- to N-campaign funnel based on the
// learning-phase rule of thumb (Meta needs ~25 results/week per campaign to
// exit learning). Pure functions, no side effects, easy to test.

import { getLumiKPIConfig } from "./lumi-kpi-config";

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
};

export type StrategyBudgetResult = {
  stages: StageBudget[];
  totalDaily: number;
  totalMonthly: number;
  leanTotalDaily: number;
  idealTotalDaily: number;
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
    // No direct CPA in the ROAS benchmark — fall back to price * 0.5 clamped.
    const price = pricePoint ?? 50;
    cost = Math.min(Math.max(price * 0.5, 20), price);
  }
  return { cost, kpiLabel: cfg.primaryLabel, kpiPrimary: cfg.primary };
}

function classifyRole(
  objective?: string,
  name?: string,
): { roleLabel: string; roleDescription: string; priority: number } {
  const o = (objective || "").toUpperCase();
  const n = (name || "").toLowerCase();

  if (n.includes("warm") || n.includes("retarget")) {
    return {
      roleLabel: "Warm retargeting",
      roleDescription: "closes people you already touched",
      priority: 3,
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
      roleDescription: "gets your brand in front of new people",
      priority: 1,
    };
  }
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICKS") || n.includes("traffic")) {
    return {
      roleLabel: "Traffic",
      roleDescription: "sends people to your site or profile",
      priority: 2,
    };
  }
  if (o.includes("ENGAGEMENT") || n.includes("engagement")) {
    return {
      roleLabel: "Engagement",
      roleDescription: "warms cold audiences for retargeting",
      priority: 2,
    };
  }
  return {
    roleLabel: name || "Campaign",
    roleDescription: "",
    priority: 2,
  };
}

// Meta updated its learning-phase guidance: ~25 conversions/week per ad set
// is enough to optimize. We size daily budgets to clear that bar.
const RESULTS_PER_WEEK_IDEAL = 25; // exits Meta's learning phase
const RESULTS_PER_WEEK_LEAN = 15; // acceptable but slower-learning floor

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

    // Cold sales rule: minimum daily budget is the offer price ÷ 2.
    // The ideal budget still sizes toward Meta's ~25 conversions/week,
    // but the starter recommendation should not inflate above that floor.
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

  // Priority order: front-end (lead/awareness/training) → conversion → warm.
  const ordered = [...enriched].sort(
    (a, b) => a.role.priority - b.role.priority || a._i - b._i,
  );

  const leanTotalDaily = ordered.reduce((s, x) => s + x.leanDaily, 0);
  const idealTotalDaily = ordered.reduce((s, x) => s + x.idealDaily, 0);

  let stages: StageBudget[] = ordered.map((s) => ({
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
  }));

  let mode: StrategyBudgetResult["mode"] = "range";
  let warning: string | undefined;
  let rationale = "";
  let requiredDailyForGoal: number | undefined;

  if (input.monthlyBudget && input.monthlyBudget > 0 && stages.length > 0) {
    mode = "monthly_budget";
    const dailyCap = input.monthlyBudget / 30;

    stages = stages.map((s) => ({ ...s, included: false, dailyBudget: 0 }));
    let remaining = dailyCap;
    for (const s of stages) {
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
    // Distribute leftover (over $1/day) to first included stage.
    if (remaining >= 1) {
      const first = stages.find((s) => s.included);
      if (first) first.dailyBudget += Math.floor(remaining);
    }

    const included = stages.filter((s) => s.included);
    const excludedColdSales = stages.find(
      (s) => !s.included && s.roleLabel === "Cold conversion",
    );
    if (included.length === 0) {
      const first = stages[0];
      warning = `This objective needs at least $${first.leanDaily}/day to give Meta enough data — at $${Math.round(dailyCap)}/day it'll struggle to optimize.`;
      rationale = `Your budget can't yet support this objective at Meta's learning-phase floor (~25 results/week).`;
    } else if (included.length < stages.length) {
      rationale = `Your $${input.monthlyBudget}/mo (~$${Math.round(dailyCap)}/day) supports ${included.length} of ${stages.length} campaigns — start with the ${included[0].roleLabel.toLowerCase()} campaign and add the rest once it's working.`;
    } else {
      rationale = `Your $${input.monthlyBudget}/mo (~$${Math.round(dailyCap)}/day) supports the full ${stages.length}-campaign funnel.`;
    }

    // Cold sales has a hard floor (price ÷ 2). If we couldn't fit it,
    // the honest recommendation is a different entry mechanism — not a
    // smaller cold-sales budget.
    if (excludedColdSales && price) {
      const floor = Math.ceil(price * 0.5);
      const note = `Selling a $${price} offer cold needs at least $${floor}/day so Meta can actually buy a sale. If that's too much, lead with a free training, lead magnet, or challenge instead of selling cold — it's the right move at this budget, not a workaround.`;
      warning = warning ? `${warning} ${note}` : note;
    }
  } else if (input.goalCount && input.goalCount > 0 && stages.length > 0) {
    mode = "goal";
    const primary = stages[0];
    requiredDailyForGoal = Math.max(
      primary.leanDaily,
      Math.round((input.goalCount * primary.targetCostPerResult) / 30),
    );
    stages = stages.map((s, i) => ({
      ...s,
      included: i === 0,
      dailyBudget: i === 0 ? requiredDailyForGoal! : 0,
    }));
    rationale = `To hit ~${input.goalCount}/month you'll need about $${requiredDailyForGoal}/day on the ${primary.roleLabel.toLowerCase()} campaign.`;
  } else {
    mode = "range";
    rationale =
      stages.length > 0
        ? `This funnel needs about $${leanTotalDaily}–$${idealTotalDaily}/day to run properly. Enter your monthly budget or goal to tailor it.`
        : `Enter your monthly budget or a goal to size this campaign.`;
  }

  const totalDaily = stages.reduce(
    (s, x) => s + (x.included ? x.dailyBudget : 0),
    0,
  );
  const totalMonthly = totalDaily * 30;

  return {
    stages,
    totalDaily,
    totalMonthly,
    leanTotalDaily,
    idealTotalDaily,
    mode,
    warning,
    rationale,
    requiredDailyForGoal,
  };
}
