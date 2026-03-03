

## Root Cause: Paused/Archived Campaigns Showing on Results Page

The "AO // Engagement - GEO - Wedding MBA" campaign is showing because:

1. **Import flow accepts ANY status** — When importing via "Refresh Ad Results" (Import from Ads Manager), the sync function imports campaigns regardless of their Meta status (ACTIVE, PAUSED, ARCHIVED). It stores the status at import time (line 281-283 in `sync-meta-campaigns`).

2. **Data page shows all non-draft campaigns** — The `fetchCampaigns` query in `Data.tsx` (line 318-332) only filters out `draft` status and placeholder IDs. It does NOT filter out paused/archived campaigns.

3. **Status only updates when metrics are fetched** — The real-time status check happens inside `fetch-meta-performance`, which correctly returns the non-ACTIVE status and sets `metrics: null`. But the campaign card still renders with a "paused" label, cluttering the page.

### Fix: Only Show ACTIVE Campaigns on the Results Page

**`src/pages/Data.tsx`** — Filter campaigns to only show those with an active/live status after metrics sync completes:

- In `fetchCampaigns` (line 318-332): After metrics are fetched and statuses are updated from Meta, filter OUT campaigns whose `meta_campaign_status` is `paused`, `archived`, `deleted`, or any non-active status
- Keep the status filter in `InsightsHome` but default to showing only `active`/`live` campaigns (removing `paused` and `imported` from defaults on line 173)

**`src/components/insights/InsightsHome.tsx`** — Change default status filter:

- Line 173: Change default from `['active', 'live', 'paused', 'imported']` to `['active', 'live']`
- This way paused/imported campaigns are still accessible via filter toggle but don't clutter the main view

**`src/components/insights/StatusFilter.tsx`** — Verify that the filter labels are clear so users can optionally toggle paused campaigns on/off

This is the least disruptive fix. Campaigns that Meta reports as non-ACTIVE simply won't show by default. Users can toggle the "Paused" filter to see them if needed.

### Files to edit
- `src/components/insights/InsightsHome.tsx` (line 173 — change default filter)
- `src/pages/Data.tsx` (optional: add a comment clarifying the filtering logic)

