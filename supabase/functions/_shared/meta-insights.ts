// Single source of truth for how LUMI queries Meta's insights API, so every
// surface (campaign cards, account overview, ad breakdown, optimization report,
// recommendations) reports the SAME numbers as each other AND as Meta Ads
// Manager. Two bugs made LUMI's numbers legitimately diverge from Ads Manager:
//
//   1. Date window. The frontend sent an explicit since/until of
//      `subDays(now, 7) .. now` — an 8-day window that INCLUDES today's
//      still-accumulating partial day, computed in the BROWSER's timezone.
//      Ads Manager's "Last 7 days" is 7 full days ending yesterday, in the AD
//      ACCOUNT's timezone. So LUMI's numbers drifted all day and never settled
//      to a figure a user could match. Passing Meta a `date_preset` instead
//      lets Meta compute the window natively — right length, right timezone,
//      no partial day.
//
//   2. Attribution. No call set an attribution window, so results / purchases /
//      leads / cost-per-result / ROAS came back under the API's legacy default
//      instead of each ad set's configured Ads-Manager attribution setting.
//      `use_unified_attribution_setting=true` makes the API mirror what the
//      user sees in Ads Manager. Spend/impressions/CPM aren't attribution-
//      dependent, which is why those looked closer while conversions didn't.

// Meta's own preset tokens. Keep this an allowlist — a preset is interpolated
// straight into the request URL, so never forward an unvalidated string.
export const META_DATE_PRESETS = new Set([
  "today",
  "yesterday",
  "last_3d",
  "last_7d",
  "last_14d",
  "last_28d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
  "maximum",
]);

export const DEFAULT_DATE_PRESET = "last_7d";

/**
 * Build the date-window query fragment for a Meta insights call.
 *
 * Preference order:
 *   1. A validated `datePreset` → `date_preset=<preset>` (Meta computes the
 *      window in the account timezone — this is what matches Ads Manager).
 *   2. An explicit `dateRangeStart`+`dateRangeEnd` (custom ranges) → `time_range`.
 *   3. Neither → `date_preset=last_7d`.
 *
 * Returns just the fragment (no leading `&`), e.g. `date_preset=last_7d`.
 */
export function buildDateWindowParam(opts: {
  datePreset?: string | null;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
}): string {
  const { datePreset, dateRangeStart, dateRangeEnd } = opts;
  if (datePreset && META_DATE_PRESETS.has(datePreset)) {
    return `date_preset=${datePreset}`;
  }
  if (dateRangeStart && dateRangeEnd) {
    return `time_range={"since":"${dateRangeStart}","until":"${dateRangeEnd}"}`;
  }
  return `date_preset=${DEFAULT_DATE_PRESET}`;
}

/**
 * Tells Meta to report conversions/ROAS under each ad set's own attribution
 * setting — i.e. the same numbers shown in Ads Manager. Append to every
 * insights URL. Returned without a leading `&` so callers add the separator.
 */
export const UNIFIED_ATTRIBUTION_PARAM = "use_unified_attribution_setting=true";
