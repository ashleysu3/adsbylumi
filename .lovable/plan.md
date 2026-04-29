## Problem

On `/ad-performance`, a campaign appears with a **LIVE** badge inside "LUMI Recommendations" (it comes from the optimization report). When the user clicks:

- **View Campaign** → drawer opens, but the default Creative tab is empty because no creative was ever generated for this workspace.
- **View Results** → page renders **"Campaign not found"** with a "Back to Overview" button.

The user is stuck in a loop with a "live" campaign they can't inspect.

## Root cause

`src/pages/Data.tsx` builds the `campaigns` array by calling `fetchCampaigns()`, which filters workspaces out when:

- `meta_campaign_ids.campaignId` is missing
- the campaign ID looks like a placeholder timestamp (`*_<timestamp>`)
- `meta_campaign_status === 'draft'`

The optimization report (`optimization_reports.report_data`), however, still includes those workspaces. So the report card shows the campaign as LIVE, but `selectedCampaign = campaigns.find(c => c.id === selectedCampaignId)` returns `undefined` and the detail view falls through to the "Campaign not found" branch.

The drawer opens fine (it fetches the workspace by ID directly), but the default "Creative" tab is empty for campaigns that never had creative generated, which feels broken.

## Fix

### 1. `src/pages/Data.tsx` — never show "Campaign not found" for a real workspace

When `selectedCampaignId` is set but not present in `campaigns`, fall back to fetching the workspace by ID and synthesizing a minimal `CampaignData` object so `CampaignInsightDetail` can still render (it already handles missing metrics gracefully via the soft-200 from `fetch-meta-performance`).

- Add a `fallbackCampaign` state.
- In the existing `useEffect` keyed on `[view, selectedCampaignId]`, if `selectedCampaignId` is not in `campaigns`, fetch the workspace row (same `select` shape as `fetchCampaigns`) and map it into `CampaignData` with safe defaults (status `live` if `meta_campaign_status === 'live'`, otherwise pass through).
- Compute `selectedCampaign = campaigns.find(...) ?? fallbackCampaign`.
- Remove the "Campaign not found" branch entirely; replace with a small loading skeleton while the fallback fetch is in flight, and only show the not-found message if the fetch returns no row.

### 2. `src/components/CampaignDetailDrawer.tsx` — friendlier empty drawer

- Default the tab to `"goals"` instead of `"creative"` when there's no `creative_json` and no `selected_copy`. This shows the LUMI suggestion / saved goals immediately (matches the screenshot's intent — a live campaign without creative data still has goals to manage).
- Add a small inline note at the top of the empty Creative tab pointing the user to "Set goals" or "View Results" so the drawer never feels blank.

### 3. Status-label safety

`CampaignInsightDetail` already handles `notPublished` from `fetch-meta-performance` (we returned 200 in the previous fix), so once the fallback workspace is passed in, the page will render the campaign header + the empty/no-metrics state instead of the dead-end "Campaign not found".

## Files to edit

- `src/pages/Data.tsx` — add fallback workspace fetch, swap "Campaign not found" for synthesized detail view.
- `src/components/CampaignDetailDrawer.tsx` — change default tab when no creative exists, add helper text in empty Creative tab.

## Out of scope

- Changing how the optimization report decides which workspaces to include.
- Any backend/edge function changes (the soft-200 fix from the previous turn already covers the metrics path).
