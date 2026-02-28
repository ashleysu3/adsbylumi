

## Plan: Campaign Name on Recommendations + Always-Visible Badges

### Problem
1. The overview-level recommendations don't show which campaign they belong to, causing confusion.
2. Badges only appear when the `generate-recommendations` edge function returns results (which depends on specific metric thresholds). If none trigger, the badge doesn't show — even though the KPI verdict already implies an action.

### Changes

#### 1. `src/components/insights/LumiRecommendations.tsx` — Show campaign name on each recommendation
- In the recommendation row (around line 308-309), after the `rec.title`, render `rec.campaignName` as a secondary `Badge` with `variant="secondary"` so the user always knows which campaign a recommendation belongs to.
- Access it via `(rec as any).campaignName` since it's added at the InsightsHome level when mapping results.

#### 2. `src/components/insights/InsightsHome.tsx` — Generate client-side fallback recommendations from KPI verdicts
- After computing `status` and `verdict` for each campaign (lines 341-346), generate a local recommendation object if the edge function returned nothing for that campaign.
- Logic:
  - `healthy` → type `budget_increase`, title "Strong performance — consider scaling", userAction false
  - `attention` → type `keep_running`, title "Monitor closely — performance is borderline", userAction true, actionUrl to detail view
  - `critical` → type `create_creative`, title "Below benchmark — refresh creative", userAction true, actionUrl `/creative`
  - `unknown` → type `keep_running`, title "Still gathering data", userAction true
- These fallback recs ensure `recCountsByWorkspace` always has a count for campaigns with any computed status, so the badge always appears.
- In `fetchRecommendations`, after building `allRecs` from the edge function, loop through `campaigns` and add a fallback rec for any campaign not already represented. Include `campaignName` and `campaignId` on each.

#### Layout
No layout changes — badges stay in Row 1 next to campaign name, overview recommendations stay at the top above campaign cards. Both already exist in the current code.

