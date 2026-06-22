import { describe, it, expect } from "vitest";
import { computeStrategyBudget, parsePricePoint } from "./strategy-budget";

const threeCampaignFunnel = [
  // Front-end lead capture — webinar CPL max ~$40 → lean ~$86/day, ideal ~$143/day
  { name: "Webinar registration", objective: "webinar" },
  // Cold conversion — Sales/ROAS, $97 offer → lean floor ~$49/day
  { name: "Cold sales", objective: "Sales" },
  // Warm retargeting — same target cost as cold sales
  { name: "Warm retargeting", objective: "Sales" },
];

describe("parsePricePoint", () => {
  it("extracts the number from messy price strings", () => {
    expect(parsePricePoint("$97")).toBe(97);
    expect(parsePricePoint("$1,997 one-time")).toBe(1997);
    expect(parsePricePoint(null)).toBeNull();
    expect(parsePricePoint("free")).toBeNull();
  });
});

describe("computeStrategyBudget", () => {
  it("drops to a single included campaign when the monthly budget can't cover the full funnel", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
      monthlyBudget: 6000, // ~$200/day — covers webinar at lean, not the rest
    });

    expect(result.mode).toBe("monthly_budget");
    const included = result.stages.filter((s) => s.included);
    expect(included.length).toBe(1);
    expect(included[0].roleLabel.toLowerCase()).toContain("free training");
    expect(included.length).toBeLessThan(result.stages.length);
  });

  it("surfaces a warning when even the cheapest campaign exceeds the daily cap", () => {
    const result = computeStrategyBudget({
      campaigns: [
        { name: "Discovery call booking", objective: "OUTCOME_LEADS" }, // CPL max ~$100 → lean ~$429/day
      ],
      pricePoint: "$2000",
      monthlyBudget: 150, // ~$5/day
    });
    expect(result.warning).toBeTruthy();
    expect(result.stages.every((s) => !s.included)).toBe(true);
  });

  it("funds the full funnel when the monthly budget is healthy", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
      monthlyBudget: 30000, // ~$1000/day — easily covers idealTotal
    });
    expect(result.mode).toBe("monthly_budget");
    expect(result.stages.every((s) => s.included)).toBe(true);
    expect(result.stages.length).toBe(3);
    // Front-end (priority 1) should come first regardless of input order.
    expect(result.stages[0].roleLabel.toLowerCase()).toContain("free training");
  });

  it("computes a required daily spend from a per-month goal", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
      goalCount: 100, // 100 leads/month
    });
    expect(result.mode).toBe("goal");
    expect(result.requiredDailyForGoal).toBeGreaterThan(0);
    expect(result.rationale).toMatch(/hit ~100\/month/);
  });

  it("returns a realistic range when neither budget nor goal is provided", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
    });
    expect(result.mode).toBe("range");
    expect(result.leanTotalDaily).toBeGreaterThan(0);
    expect(result.idealTotalDaily).toBeGreaterThanOrEqual(result.leanTotalDaily);
    expect(result.rationale).toMatch(/\$\d+–\$\d+\/day/);
  });

  it("uses half the offer price as the cold-sales starter floor", () => {
    const result = computeStrategyBudget({
      campaigns: [{ name: "Cold conversion", objective: "OUTCOME_SALES" }],
      pricePoint: "$497",
    });
    expect(result.stages[0].leanDaily).toBe(249);
    expect(result.leanTotalDaily).toBe(249);
  });
});
