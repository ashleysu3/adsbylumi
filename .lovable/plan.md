# Fix budget changes silently failing + add a clear Creative Fatigue indicator

Two problems to solve:

### 1. "She changed the budget in Lumi but it didn't go to Meta"

The `update-meta-budget` edge function is actually working correctly — it's just **refusing to act in ambiguous cases and the user isn't seeing why**. Specifically, when:

- The campaign is ABO (Ad Set Budgets) with **2+ active ad sets**, AND
- The caller didn't specify which ad set to target

…the function returns a 400 with an explanatory error. The frontend (`BudgetAdjustmentPanel.handleSaveBudget`) shows a tiny `toast.error(...)`, the panel closes, and from the user's perspective "nothing happened." This is exactly what's happening here.

The "Scale 20%" recommendation lands a `targetAdSet` of `null` whenever `findScalingTarget` can't find a Scaling-role ad set OR when the Scaling ad set's `dailyBudget` is unknown — so the request reaches Meta with no `adSetId` and Meta sees an ABO campaign with multiple sets and refuses.

### 2. "Make creative fatigue easy to understand"

Today, fatigue only surfaces inside long recommendation copy ("Your frequency is getting high — time for fresh creative") buried in CampaignInsightDetail. There's no at-a-glance indicator on the campaign card and no plain-English explanation of what frequency even means.

---

## What we'll build

### Part A — Stop budget changes from silently failing

1. **Loud, explanatory error UI** in `BudgetAdjustmentPanel`. Replace the toast with an inline error block inside the panel that:
   - Stays visible (panel does NOT close on failure)
   - Uses plain English: "We couldn't update this budget on Meta. Here's why: [reason]"
   - When Meta returns multiple ad sets to choose from, render a list of the ad sets with their current budgets and a "Pick one" button next to each — clicking pre-fills `targetAdSet` and re-saves
   - When campaign is CBO + adSetId mismatch, explain CBO in one sentence

2. **Pre-flight ad-set picker** in `BudgetAdjustmentPanel`: if the user opens the panel and the campaign has multiple active ad sets but no `targetAdSet` was passed, show the same picker proactively before they hit Save (instead of letting them save then fail).

3. **Server returns picker payload**: confirm `update-meta-budget` already returns `adSets[]` in its 400 response (it does) — frontend will consume that to render the picker.

### Part B — Plain-English Creative Fatigue indicator

1. **New shared helper** `getFatigueStatus(frequency, ctrTrend?)` returning:
   - `none` — frequency < 2.5
   - `early` — 2.5 ≤ frequency < 3.5  ("Your audience is starting to see this a lot")
   - `building` — 3.5 ≤ frequency < 4.5  ("Same people seeing your ad many times — refresh soon")
   - `high` — frequency ≥ 4.5  ("Audience is tapped out — refresh creative now")

2. **Compact badge on each campaign card** in `InsightsHome` (next to the existing status pill) — renders only when fatigue is `early`, `building`, or `high`. Color-coded (muted / amber / red) with a tooltip that explains in one sentence what frequency means and what to do.

3. **Detail-view fatigue card** in `CampaignInsightDetail`: a small dedicated section under the KPI summary that shows the frequency number, the plain-English status label, a one-line explanation ("Each person has seen your ad ~X times in this window"), and a clear CTA — "Refresh creative" linking to `/creative?workspace=...&refreshCreative=true`.

4. **Standardize the threshold** at 3.5 / 4.5 across the app (matches the existing `getBudgetVerdict` 3.5 cutoff and the brand-level `frequency_warning` default of 4 so we don't introduce a third number).

---

## Technical notes

- Files touched:
  - `src/components/insights/BudgetAdjustmentPanel.tsx` — inline error state, ad-set picker, no auto-close on failure
  - `src/components/insights/InsightsHome.tsx` — fatigue badge on cards
  - `src/components/insights/CampaignInsightDetail.tsx` — fatigue section
  - `src/lib/fatigue.ts` (new) — single helper used by both
- No edge function changes required; `update-meta-budget` already returns the `adSets` payload we need.
- No database changes.
- No new dependencies.
- Tone follows project memory: advisory ("We recommend refreshing"), creator-friendly language, no jargon.
