import { describe, it, expect } from "vitest";
import { computeStrategyBudget, parsePricePoint } from "./strategy-budget";

const threeCampaignFunnel = [
  // Front-end lead capture — webinar (main)
  { name: "Webinar registration", objective: "webinar" },
  // Cold conversion — sales, $97 offer (secondary main)
  { name: "Cold sales", objective: "Sales" },
  // Warm retargeting (supplemental)
  { name: "Warm retargeting", objective: "Sales" },
];

describe("parsePricePoint", () => {
  it("extracts the number from messy price strings", () => {
    expect(parsePricePoint("$97")).toBe(97);
    expect(parsePricePoint("$1,997 one-time")).toBe(1997);
    expect(parsePricePoint("$97/mo or $997 pay in full")).toBe(997);
    expect(parsePricePoint(null)).toBeNull();
    expect(parsePricePoint("free")).toBeNull();
  });
});

describe("computeStrategyBudget", () => {
  it("only requires the main campaign when budget can't cover the full funnel", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
      monthlyBudget: 3000, // ~$100/day
    });

    expect(result.mode).toBe("monthly_budget");
    const required = result.stages.filter((s) => s.required);
    expect(required.length).toBe(1);
    expect(required[0].tier).toBe("main");
    const includedMain = result.stages.find((s) => s.included && s.required);
    expect(includedMain).toBeTruthy();
  });

  it("surfaces a warning when the required main campaign can't be funded", () => {
    const result = computeStrategyBudget({
      campaigns: [
        { name: "Discovery call booking", objective: "OUTCOME_LEADS" },
      ],
      pricePoint: "$2000",
      monthlyBudget: 150, // ~$5/day
    });
    expect(result.warning).toBeTruthy();
    expect(result.stages.every((s) => !s.included)).toBe(true);
  });

  it("funds the full funnel with supplemental at a small fraction when budget is healthy", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
      monthlyBudget: 30000,
    });
    expect(result.mode).toBe("monthly_budget");
    expect(result.stages.every((s) => s.included)).toBe(true);
    expect(result.stages[0].tier).toBe("main");
    // Supplemental spend is far smaller than main spend.
    expect(result.supplementalDaily).toBeLessThan(result.mainDaily);
    expect(result.supplementalDaily).toBeGreaterThan(0);
  });

  it("only funds the main campaign when sized to a per-month goal", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
      goalCount: 100,
    });
    expect(result.mode).toBe("goal");
    expect(result.requiredDailyForGoal).toBeGreaterThan(0);
    const included = result.stages.filter((s) => s.included);
    expect(included.length).toBe(1);
    expect(included[0].tier).toBe("main");
  });

  it("returns a range with main + optional supplemental when no budget or goal is given", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
    });
    expect(result.mode).toBe("range");
    expect(result.leanTotalDaily).toBeGreaterThan(0);
    expect(result.idealTotalDaily).toBeGreaterThanOrEqual(result.leanTotalDaily);
    expect(result.rationale.toLowerCase()).toContain("supplemental");
  });

  it("uses half the offer price as the cold-sales starter floor", () => {
    const result = computeStrategyBudget({
      campaigns: [{ name: "Cold conversion", objective: "OUTCOME_SALES" }],
      pricePoint: "$497",
    });
    expect(result.stages[0].leanDaily).toBe(249);
    expect(result.stages[0].tier).toBe("main");
    expect(result.stages[0].required).toBe(true);
  });
});
