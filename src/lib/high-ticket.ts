// High-ticket offer rules.
//
// LUMI treats any offer priced at HIGH_TICKET_THRESHOLD or above as
// "high-ticket": cold traffic almost never converts directly into a
// purchase at that price, so the recommended play is a sales campaign
// to a WARM audience (existing list, retargeting, engagers, customers)
// paired with a top-of-funnel cold campaign (engagement / traffic /
// awareness / leads) that fills the warm pool.
//
// If the user insists on running a high-ticket sales campaign cold,
// they need a much larger daily budget — Meta needs ~25 conversions/week
// to optimize and at $500+ that means a real spend floor. We use
// price ÷ 10 as the minimum recommended daily spend for high-ticket
// cold sales, with a hard floor of $50/day.

import { parsePricePoint } from "./strategy-budget";

export const HIGH_TICKET_THRESHOLD = 500;
const COLD_HIGH_TICKET_MIN_DAILY_FLOOR = 50;

export type HighTicketGuidance = {
  isHighTicket: boolean;
  price: number | null;
  /** Recommended minimum daily budget if the user insists on cold sales. */
  minDailyForCold: number;
  /** Short one-line headline for inline UI. */
  headline: string;
  /** Plain-English recommendation paragraph. */
  recommendation: string;
  /** Plain-English warning shown when the user overrides to cold sales. */
  coldOverrideWarning: string;
};

export function getHighTicketGuidance(
  pricePoint: string | number | null | undefined,
): HighTicketGuidance {
  const price =
    typeof pricePoint === "number"
      ? pricePoint
      : parsePricePoint(pricePoint ?? null);
  const isHighTicket = !!price && price >= HIGH_TICKET_THRESHOLD;
  const minDailyForCold = price
    ? Math.max(COLD_HIGH_TICKET_MIN_DAILY_FLOOR, Math.ceil(price / 10))
    : COLD_HIGH_TICKET_MIN_DAILY_FLOOR;

  return {
    isHighTicket,
    price: price ?? null,
    minDailyForCold,
    headline: isHighTicket
      ? "This is a high-ticket offer — best sold to a warm audience"
      : "",
    recommendation: isHighTicket
      ? `At $${price}, cold strangers rarely buy on the first ad. LUMI recommends a sales campaign to a WARM audience only (your list, retargeting, page engagers, past customers) — paired with a cold engagement, traffic, awareness, or leads campaign that fills that warm pool over time.`
      : "",
    coldOverrideWarning: isHighTicket
      ? `Selling a $${price} offer to a cold audience needs a much larger budget for any real chance of working — plan on at least $${minDailyForCold}/day so Meta has enough data to find the rare cold buyer. Lower budgets will burn out before they learn.`
      : "",
  };
}

/** True when the offer price clears the high-ticket threshold. */
export function isHighTicket(pricePoint: string | number | null | undefined): boolean {
  return getHighTicketGuidance(pricePoint).isHighTicket;
}
