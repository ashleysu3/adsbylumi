

## Unified Ad Performance Page — Single View with Active Monitoring

### Problem
1. The "Weekly Check-In" tab doesn't load properly and duplicates functionality from "Live Performance"
2. Two tabs create confusion — users want one place to see what's happening and what to do
3. No proactive LUMI notifications when campaigns need attention (especially for agency accounts)

### Solution: Merge into One View + Add Proactive Alert System

#### Part 1 — Merge Tabs into a Single Unified View

**File: `src/pages/Data.tsx`**

Remove the `Tabs` wrapper entirely. Render a single unified view that combines:

1. **Top section**: Account-level summary cards (spend, impressions, CTR, CPC) from the existing `AccountOverview` component — this stays
2. **Campaign health status row**: Green/Yellow/Red summary counts from the optimization report (currently in Weekly Check-In) — pull from `optimization_reports` on load, auto-refresh if stale (>3 hours)
3. **Campaign list**: Each campaign card shows:
   - Status dot (green/yellow/red/gray)
   - Campaign name + live badge
   - Key metrics inline (Spend, CTR, CPC, CPL/ROAS, Frequency)
   - LUMI recommendations with action buttons (from optimization report)
   - "Set Goals" prompt if unconfigured
   - Click → opens `CampaignInsightDetail` (existing deep-dive view)
4. **Date range picker**: Single date range selector (from Live Performance) that controls both metric fetching AND report generation
5. **Action bar**: "Run Report" button, Share popover, Digest Settings gear — moved to the header area

Delete the `WeeklyCheckInTab` function entirely. Its report-running logic, digest settings dialog, and campaign card rendering get absorbed into the main component.

The `InsightsHome` component (untouched per instructions) still renders for the campaign list view. The optimization report data overlays onto it — status dots and LUMI recommendations appear alongside live metrics.

#### Part 2 — Auto-Run Reports on Page Load

Instead of requiring users to manually click "Run Report Now":
- On page load, check the most recent `optimization_reports` entry for this brand
- If none exists or it's older than 3 hours, auto-trigger `run-optimization-report` in the background
- Show a subtle "LUMI is checking your campaigns..." indicator during the run
- Once complete, overlay the status dots and recommendations onto the campaign cards

#### Part 3 — Proactive Email Alerts for Red-Status Campaigns

**No new edge functions** — enhance the existing `send-critical-alerts` function behavior by having the `schedule-digests` cron also trigger alerts when red-status campaigns are detected.

**File: `src/pages/Data.tsx`** — Add a settings toggle in the digest settings dialog:
- "Send me an alert immediately when LUMI detects a campaign needs urgent action" (toggle, default ON)
- Store as `alert_on_red` boolean in `digest_settings`

**Database migration**: Add column to `digest_settings`:
```sql
ALTER TABLE public.digest_settings 
ADD COLUMN IF NOT EXISTS alert_on_red boolean DEFAULT true;
```

**File: `supabase/functions/schedule-digests/index.ts`** — After running the optimization report in the cron, check if any campaigns came back red. If `alert_on_red` is true, invoke `send-critical-alerts` with the red campaign data. This uses existing infrastructure — no new edge functions.

#### Part 4 — In-App Alert Banner

**File: `src/pages/Data.tsx`** — At the top of the page, if the latest report has red-status campaigns, show a persistent alert banner:

```
🚨 2 campaigns need your attention — LUMI has recommendations ready
```

With a "View" button that scrolls to the first red campaign card.

#### Part 5 — Agency Account Enhancement

For agency users (`isAgencyUser` from `useBrand`), the digest settings dialog gets an additional section:
- "Monitor all brands" toggle — when enabled, the cron checks all brands under this user and sends a consolidated alert email
- This uses the existing `schedule-digests` function which already loops through `digest_settings` entries per brand

### Files Changed
- `src/pages/Data.tsx` — Major refactor: remove tabs, merge views, add auto-report, add alert banner
- `supabase/functions/schedule-digests/index.ts` — Add red-alert trigger after report runs
- `src/components/AppSidebar.tsx` — No changes needed (notification badge already exists)
- Database migration: add `alert_on_red` column to `digest_settings`

### Files NOT Changed
- No files in `src/components/insights/`
- No other edge functions
- No changes to `CampaignDetailDrawer`

