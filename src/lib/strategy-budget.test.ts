import { describe, it, expect } from "vitest";
import { computeStrategyBudget, parsePricePoint } from "./strategy-budget";

const threeCampaignFunnel = [
  // Front-end lead capture — webinar (supplemental when cold sales exists)
  { name: "Webinar registration", objective: "webinar" },
  // Cold conversion — sales, $97 offer (main)
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
    expect(required[0].roleLabel).toBe("Cold conversion");
    const includedMain = result.stages.find((s) => s.included && s.required);
    expect(includedMain).toBeTruthy();
    expect(result.mainDaily).toBeGreaterThan(result.supplementalDaily);
  });

  it("keeps the required main funded first and warns when it is under target", () => {
    const result = computeStrategyBudget({
      campaigns: [
        { name: "Discovery call booking", objective: "OUTCOME_LEADS" },
      ],
      pricePoint: "$2000",
      monthlyBudget: 150, // ~$5/day
    });
    expect(result.warning).toBeTruthy();
    expect(result.stages[0].included).toBe(true);
    expect(result.stages[0].dailyBudget).toBe(5);
  });

  it("funds the full funnel with supplemental at a small fraction when budget is healthy", () => {
    const result = computeStrategyBudget({
      campaigns: threeCampaignFunnel,
      pricePoint: "$97",
      monthlyBudget: 30000,
    });
    expect(result.mode).toBe("monthly_budget");
    expect(result.stages.every((s) => s.included)).toBe(true);
    expect(result.stages.find((s) => s.required)?.roleLabel).toBe("Cold conversion");
    // Supplemental spend is far smaller than main spend.
    expect(result.supplementalDaily).toBeLessThan(result.mainDaily);
    expect(result.supplementalDaily).toBeGreaterThan(0);
  });

  it("never lets top-of-funnel supplemental layers take the majority", () => {
    const result = computeStrategyBudget({
      campaigns: [
        { name: "Awareness warm up", objective: "OUTCOME_AWARENESS" },
        { name: "Traffic warm up", objective: "OUTCOME_TRAFFIC" },
        { name: "Cold sales", objective: "OUTCOME_SALES" },
        { name: "Warm retargeting", objective: "OUTCOME_SALES" },
      ],
      pricePoint: "$997",
      monthlyBudget: 3000,
    });
    expect(result.stages.find((s) => s.required)?.roleLabel).toBe("Cold conversion");
    expect(result.mainDaily).toBeGreaterThan(result.supplementalDaily);
    expect(result.stages.filter((s) => s.tier === "supplemental").every((s) => !s.required)).toBe(true);
    expect(result.warning).toContain("may not reach 25 conversions/week");
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

  it("uses the archetype's test-daily range as the floor for the primary main", () => {
    // lead_gen_funnels test range is $50–300/day.
    const result = computeStrategyBudget({
      campaigns: [{ name: "Webinar registration", objective: "LEAD_GENERATION" }],
      pricePoint: "$0",
      archetypeSlug: "lead_gen_funnels",
    });
    expect(result.stages[0].leanDaily).toBeGreaterThanOrEqual(50);
    expect(result.stages[0].idealDaily).toBeGreaterThanOrEqual(300);
    expect(result.rationale).toMatch(/Lead Generation Funnel/);
  });

  it("flags launch-window-only models in the rationale", () => {
    const result = computeStrategyBudget({
      campaigns: [{ name: "Open enrollment", objective: "Sales" }],
      pricePoint: "$200",
      archetypeSlug: "community_membership",
    });
    expect(result.rationale).toMatch(/open-enrollment/i);
  });

  it("scales retargeting to 2-3x cold spend for ecommerce", () => {
    // With ecommerce archetype, supplemental (warm/retarget) total can be up
    // to 3× main spend instead of the default ~25% cap.
    const ecomFunnel = [
      { name: "Cold conversion", objective: "OUTCOME_SALES" },
      { name: "Warm retargeting", objective: "OUTCOME_SALES" },
    ];
    const result = computeStrategyBudget({
      campaigns: ecomFunnel,
      pricePoint: "$60",
      archetypeSlug: "ecommerce",
    });
    const main = result.stages.find((s) => s.tier === "main")!;
    expect(result.idealTotalDaily).toBeGreaterThan(main.idealDaily); // supplemental > 0
    // Total exceeds the default 25% cap (proves multiplier kicked in).
    expect(result.idealTotalDaily).toBeGreaterThan(main.idealDaily * 1.5);
  });
});
