

## Plan: Generate Client-Ready Weekly Report with Historical Tracking

### What We're Building

A "Generate Report" button on the Results dashboard that produces a polished, copy-paste-ready client report matching your current format (with status emojis, per-campaign breakdowns, daily budgets, final notes). It also saves each report to a historical log so you can track recommendations week-over-week and measure progress toward goals.

### Architecture

**New edge function: `generate-client-report`**
- Accepts `brandId` and `dateRange` (start/end)
- Fetches ALL campaign workspaces for that brand with `meta_campaign_ids`
- For each campaign: pulls current metrics from `performance_history`, goals from `final_answers`, template/objective info
- Uses AI (Lovable AI / Gemini Flash) to generate the formatted report with:
  - Status emoji assignment per campaign (✅ meeting goal, ⚠️ needs intervention, 👀 watching, ❌ turned off)
  - Per-campaign sections: primary KPI vs goal, total conversions, standout/underperforming creatives, notes
  - Daily budgets summary section
  - Total spend & revenue for period
  - Final strategic notes
- Loads **previous reports** from a new `weekly_reports` table to include week-over-week context (e.g., "CPL improved from $5.20 last week to $4.95 this week")
- Saves the generated report + structured data (metrics snapshot, recommendations) to `weekly_reports` table

**New DB table: `weekly_reports`**
- `id`, `brand_id`, `created_at`, `date_range_start`, `date_range_end`
- `report_text` (the formatted output)
- `metrics_snapshot` (JSONB — per-campaign metrics at time of report)
- `recommendations_snapshot` (JSONB — what was recommended)
- `campaign_statuses` (JSONB — status emoji assignments per campaign)
- RLS: users can CRUD their own brand's reports

**Frontend: "Generate Report" button on InsightsHome**
- Button in the header area of the Results dashboard
- On click: calls `generate-client-report`, shows a loading modal
- On complete: opens a modal/drawer with the formatted report text + "Copy to Clipboard" button
- Below the report: a collapsible "Report History" section showing past reports with dates, allowing comparison

**Frontend: Report history viewer**
- Small "Past Reports" link/accordion on the Results page
- Shows list of past reports by date
- Click to view any past report
- Week-over-week trend indicators on key metrics

### Key Report Format Improvements Over Current

Based on your example:
- Status emojis (✅⚠️👀❌) assigned per campaign based on goal comparison
- Specific creative callouts (top performers by name with metrics)
- Daily budgets section at bottom
- Total spend + revenue summary
- Strategic "Final Notes" section
- Week-over-week comparison notes inline (e.g., "CPL improved from $X.XX last week")

### Files to Create/Modify

1. **Create** `supabase/functions/generate-client-report/index.ts` — AI-powered report generation
2. **Create** DB migration for `weekly_reports` table
3. **Modify** `src/components/insights/InsightsHome.tsx` — add Generate Report button + report modal
4. **Create** `src/components/insights/ClientReportModal.tsx` — report display + copy + history

### Technical Details

The edge function will:
1. Fetch all active campaign workspaces for the brand
2. For each, get metrics, goal, template objective, daily budget
3. Query `weekly_reports` for the most recent prior report to compare metrics
4. Build a structured prompt for AI that includes the example format, current data, and prior week data
5. AI generates the formatted text report
6. Save report + snapshots to `weekly_reports`
7. Return the report text

The `metrics_snapshot` JSONB stores per-campaign data at report time so historical comparison is always available regardless of Meta data changes.

