// Audience recommendation rule for the campaign builder.
//
// Trigger (both must be true):
//   1. offer_price >= 497 (treated as USD-equivalent; brands don't store
//      a currency, so we apply the numeric threshold to the parsed price).
//   2. weekly_budget < 25 * estimated_cost_per_purchase
//      where weekly_budget = daily_budget * 7.
//
// estimated_cost_per_purchase:
//   - if a known average CPA for this offer/account is supplied, use it
//     (source: "historical").
//   - otherwise fall back to 50% of the offer price (source: "fallback").
//
// When triggered we default the audience to "warm" and surface a plain-
// language reason. The user can override to cold/broad — this is a
// recommendation, not a hard block.

import { parsePricePoint } from "./strategy-budget";

export const AUDIENCE_PRICE_TRIGGER = 497;
export const TARGET_WEEKLY_PURCHASES = 25;
export const CPP_FALLBACK_RATIO = 0.5;

export type AudienceRecommendation = {
  /** True when both trigger conditions are met. */
  triggered: boolean;
  /** Parsed numeric offer price, or null if unknown. */
  price: number | null;
  /** Daily budget echoed back. */
  dailyBudget: number;
  /** daily_budget * 7. */
  weeklyBudget: number;
  /** The CPP we used in the math. */
  estimatedCPP: number | null;
  /** Where the CPP came from. */
  cppSource: "historical" | "fallback" | "unknown";
  /** What weekly_budget would need to be to hit ~25 purchases/week cold. */
  neededWeeklyForCold: number | null;
  /** Plain-language reason shown in the UI when triggered. */
  reason: string;
  /** Short label describing the CPP source for the UI footnote. */
  cppSourceLabel: string;
};

export type AudienceRecommendationInput = {
  offerPrice: string | number | null | undefined;
  dailyBudget: number;
  /** Average CPA for this offer pulled from Meta history, if available. */
  historicalCPA?: number | null;
};

export function getAudienceRecommendation(
  input: AudienceRecommendationInput,
): AudienceRecommendation {
  const { offerPrice, dailyBudget, historicalCPA } = input;
  const price =
    typeof offerPrice === "number"
      ? offerPrice
      : parsePricePoint(offerPrice ?? null);
  const weeklyBudget = Math.max(0, (dailyBudget || 0) * 7);

  let cpp: number | null = null;
  let cppSource: AudienceRecommendation["cppSource"] = "unknown";
  if (typeof historicalCPA === "number" && historicalCPA > 0) {
    cpp = historicalCPA;
    cppSource = "historical";
  } else if (price && price > 0) {
    cpp = Math.round(price * CPP_FALLBACK_RATIO);
    cppSource = "fallback";
  }

  const neededWeeklyForCold = cpp ? cpp * TARGET_WEEKLY_PURCHASES : null;
  const priceQualifies = !!price && price >= AUDIENCE_PRICE_TRIGGER;
  const budgetQualifies =
    !!neededWeeklyForCold && weeklyBudget < neededWeeklyForCold;
  const triggered = priceQualifies && budgetQualifies;

  const cppSourceLabel =
    cppSource === "historical"
      ? "Based on this account's real cost-per-purchase from Meta."
      : cppSource === "fallback"
        ? "Estimated as 50% of the offer price (no Meta purchase history yet)."
        : "";

  const reason = triggered
    ? `This is a higher-priced offer ($${price}) and your current budget ($${dailyBudget}/day, ~$${weeklyBudget}/week) is below what's typically needed to find ~${TARGET_WEEKLY_PURCHASES} buyers/week from a cold audience (~$${Math.round(neededWeeklyForCold!).toLocaleString()}/week at an estimated $${Math.round(cpp!)} per purchase). We recommend starting with a warm audience — your list, past customers, page engagers, retargeting. You can override this.`
    : "";

  return {
    triggered,
    price: price ?? null,
    dailyBudget,
    weeklyBudget,
    estimatedCPP: cpp,
    cppSource,
    neededWeeklyForCold,
    reason,
    cppSourceLabel,
  };
}
