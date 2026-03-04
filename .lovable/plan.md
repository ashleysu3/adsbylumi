

## Plan: Improve Report Modal + Add Reports & Performance History to My Brand

### Part 1: Fix Report Modal (ClientReportModal.tsx)

**Problem**: Report text is cramped in a small `max-h-[50vh]` scroll area, displayed as raw `<pre>` text with the legend embedded inline.

**Changes to `src/components/insights/ClientReportModal.tsx`**:

1. **Make modal larger and fully scrollable**: Change `max-w-2xl` to `max-w-4xl` and `max-h-[85vh]` to `max-h-[90vh]`. Remove the inner `max-h-[50vh]` constraint on the ScrollArea so the report fills the available space.

2. **Parse and format the report text**: Instead of rendering raw `<pre>` text, parse the report sections (lines starting with `===`) into styled cards/sections with proper headings, spacing, and visual hierarchy. Detect section headers like `=== WEEKLY OVERVIEW ===`, `=== WHAT WORKED ===`, etc. and render them as styled section titles.

3. **Extract legend to top**: Parse emoji status indicators (green/yellow/red meanings) and campaign status emojis from the report text and render them as a sticky legend bar at the top of the report view, outside the scrollable content area.

4. **Sticky action bar**: Keep the Copy Report / New Report buttons in a sticky footer so they're always accessible while scrolling.

### Part 2: Add Past Reports & Weekly Performance Dashboard to My Brand (Dashboard.tsx)

**Changes to `src/pages/Dashboard.tsx`**:

1. **Add a "Performance History" card** after the existing brand sections that:
   - Fetches `weekly_reports` for the active brand
   - Shows a Recharts `LineChart` plotting key metrics (spend, CPL/CPP, CTR, ROAS) week-over-week using `metrics_snapshot` from each report row
   - X-axis: week ending date, Y-axis: metric values
   - Toggle between metrics via small tabs/buttons

2. **Add a "Past Reports" card** below the chart that:
   - Lists all past reports from `weekly_reports` table
   - Each row shows date range, campaign status emojis
   - Clicking a report opens a read-only version of the `ClientReportModal` (reuse the component with a `viewingPast` prop pre-set)

**New imports needed in Dashboard.tsx**: `FileText`, `BarChart3` from lucide-react, `LineChart`/`Line`/`XAxis`/`YAxis`/`Tooltip`/`ResponsiveContainer` from recharts, `ClientReportModal`.

### Technical Details

- The `weekly_reports` table already has `metrics_snapshot` (jsonb), `report_text`, `date_range_start`, `date_range_end`, and `campaign_statuses` columns -- all needed data is available
- Report text parsing uses simple string splitting on `=== SECTION ===` patterns
- No database changes needed
- No new edge functions needed

### Files Modified
- `src/components/insights/ClientReportModal.tsx` — modal sizing, report formatting, legend extraction
- `src/pages/Dashboard.tsx` — add Performance History chart + Past Reports section

