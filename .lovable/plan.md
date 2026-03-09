

## Clean Up Recommendations + Add In-App Report Preview

### Problem
1. Two edge functions (`generate-recommendations` and `run-optimization-report`) contain landing page/offer/downstream advice that's outside LUMI's scope as an ads platform
2. No way to preview the email report format in-app before it sends — "Run Report" updates data but doesn't show the formatted report
3. The report format (both email and in-app) should clearly show: each campaign, its goal, its results, and LUMI's recommended next step

### Changes

#### 1. Remove landing page / offer / downstream advice from both edge functions

**`supabase/functions/generate-recommendations/index.ts`** (lines 181-195, 230-244):
- Line 186: Replace the "conversion-problem" recommendation that says "The issue is post-click: landing page copy, load speed, or offer clarity" with ads-only advice: "Clicks aren't converting — try testing new audiences, adjusting your targeting, or pausing your weakest-performing ads to let Meta re-optimize delivery."
- Line 231-235: Replace the "downstream" recommendation that says "Check your sales process, follow-up sequence, or offer page" with: "Your CPL is at goal but ROAS isn't — this means the ad is doing its job. Consider testing purchase-optimized campaigns or adjusting your audience to reach higher-intent buyers."

**`supabase/functions/run-optimization-report/index.ts`** (lines 436-448):
- Line 439: Replace "CTR is decent but cost per result is too high — people are clicking but not converting. Drill into ad-level breakdown and pause underperformers." — keep the "Drill into ad-level breakdown and pause underperformers" part, remove any post-click references
- Line 446: Replace "Leads are coming in at goal but purchases aren't closing. This is downstream of the ads — the ad itself is working." with ads-focused guidance about testing purchase-optimized campaigns

#### 2. Add in-app report preview dialog

**`src/pages/Data.tsx`**:
- Add a `reportPreviewOpen` state boolean
- When "Run Report" completes successfully, automatically open a dialog showing the report in the same structured format as the email
- The dialog renders each campaign card with: status dot, campaign name, goal vs. actual KPI values, frequency, LUMI recommendations, and budget hog warnings
- Add a "Send via Email" button in the dialog footer that triggers `send-optimization-digest` for the current report
- Add a "Preview Report" button next to "Run Report" that opens the same dialog using the latest cached `optimizationReport` data (without re-running)

The dialog layout mirrors the email template structure:
- Summary bar at top (green/yellow/red counts)
- Campaign cards sorted red → yellow → green
- Each card shows: status emoji + name, primary KPI actual vs goal, secondary KPI if set, frequency vs threshold, LUMI recommendations, budget hog warnings
- Footer: "Send Email Now" button + "Close"

#### 3. Ensure report format consistency

Both the email (`send-optimization-digest`) and the in-app preview will render the same data structure from `optimization_reports.report_data`. The email already renders goals/results/recommendations per campaign — the in-app preview will match this format using React components instead of HTML strings.

### Files Changed
- `supabase/functions/generate-recommendations/index.ts` — Remove landing page/offer/downstream language from 2 recommendations
- `supabase/functions/run-optimization-report/index.ts` — Remove landing page/downstream language from 2 recommendations  
- `src/pages/Data.tsx` — Add report preview dialog with matching email format + "Send Email" action

### No database changes needed

