

## Plan: Fix Campaign Card Issues (Goals Editing, $ Badge, Recommendations, Data)

### Issues Identified

**1. Rogue `$ —` badge** (lines 682-686 in InsightsHome.tsx)
When `dailyBudget` is `undefined` but `lastSyncedAt` exists, a pill showing `$ —` renders. This is useless UI noise. Remove this fallback entirely — only show the budget pill when there's an actual budget value.

**2. No way to edit goals from campaign cards**
Currently goals can only be edited from the detail view (CampaignInsightDetail). The KPI summary cells on the campaign cards should be tappable to open a quick goal editor. Add a small edit affordance on the KPI summary that opens a popover with the existing `CampaignGoalRow` component, allowing inline goal editing. When goals are saved, refresh the `goalsMap` state.

**3. KPI data not pulling (ROAS showing "—")**
The `getMetricValue` function checks `metrics[key] != null`, but ROAS values of `0` pass this check yet get treated as "no data" by the status logic. The real issue is that the ROAS metric from Meta may be stored under a different key or not computed. The component already handles `roas` in the metrics object, but the campaign's `metrics.roas` may actually be `null` or `0`. For campaigns with purchases and spend, we should compute ROAS on the fly: `revenue / spend`. Will add a computed ROAS fallback in `getMetricValue`.

**4. Duplicate recommendations**
The deduplication in `fetchRecommendations` only deduplicates by exact description match. The `next_steps` from `performance_report_latest` are being added even when generate-recommendations already returned similar advice. Additionally, the global deduplication `Set` tracks descriptions across campaigns but the `next_steps` section uses a per-campaign filter. Fix: use a single global deduplication set for ALL recommendation descriptions, and also deduplicate by semantic similarity (normalize descriptions before comparing).

**5. Poor recommendation quality ("Wait for more data" on mature campaigns)**
The `getActionRecommendation` function (line 150-157) returns "Wait for more data" when status is `no-data`. But for ROAS campaigns, a `0` ROAS triggers `no-data` even when the campaign has plenty of spend/clicks data. Fix: check if the campaign has meaningful delivery data (spend > $50, impressions > 1000) before defaulting to "Wait for more data". For mature campaigns with delivery but missing conversion data, recommend "Try new angles" or "Check tracking" instead.

### Implementation

**File: `src/components/insights/InsightsHome.tsx`**
- Remove the `$ —` fallback badge (lines 682-686)
- Update `getActionRecommendation` to accept campaign metrics and distinguish between truly new campaigns vs campaigns with delivery but no conversion tracking
- Fix global deduplication: use a single `Set` across all recommendation sources, normalize strings
- Add a goals edit popover on each campaign card (small pencil icon next to KPI summary) that opens inline goal editing via `CampaignGoalRow`, with a callback to refetch/update `goalsMap`

**File: `src/components/insights/CampaignKPISummary.tsx`**
- Add an optional `onEditGoals` callback prop
- Add a subtle tap/click affordance (pencil icon or "Edit" link) on the KPI strip that triggers the callback
- Add ROAS computation fallback in `getMetricValue`: if `roas` is null/0 but `revenue` and `spend` exist, compute it

**File: `src/components/insights/CampaignGoalRow.tsx`** (no changes needed, reuse as-is)

### Key Logic Changes

**Smarter action recommendations:**
```
if status == 'no-data':
  if spend > 50 or impressions > 1000:
    → "Check tracking" or "Try new angles" 
  else:
    → "Wait for more data"
```

**Goal editing flow:**
- Pencil icon on KPI strip → opens Popover with goal editor
- On save → upsert to `campaign_goals` table → update local `goalsMap` state
- KPI cells re-render with new goal thresholds and colors

