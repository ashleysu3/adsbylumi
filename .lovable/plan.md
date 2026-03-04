

## Plan: Add "What's Worked Before?" Analysis Entry Point in Creative Studio

### What Changes

**In the empty angles state** (when a workspace is selected but no angles exist yet), add a secondary button below the "Generate Angles" CTA that says **"See What's Worked"** (or similar). Clicking it opens the existing `CreativeRefreshDialog`, which already handles the full analysis flow — fetching 90-day performance data, showing top formats/angles, and offering "Build on What's Working" vs "Start Fresh."

This reuses the existing `CreativeRefreshDialog` component and `analyze-past-creatives` edge function with zero new backend work.

### File: `src/pages/CreativeStudio.tsx`

1. In the empty angles card (lines ~921-941), add a second button below "Generate Angles":
   - Label: **"See What's Worked"** with a `BarChart3` icon
   - Subtitle text: "Analyze your recent ad performance first"
   - Clicking it sets `showRefreshDialog = true`
   - Only show this button when the brand has a `meta_account_id` connected (since the analysis requires Meta data)

2. The existing `CreativeRefreshDialog` (already rendered at line 1267) and its handlers already work correctly for this use case — no changes needed there.

### Technical Details

- Import `BarChart3` from lucide-react (already used elsewhere in the project)
- Check `workspace?.brands?.meta_account_id` to conditionally show the button
- No database changes, no new edge functions, no new components

