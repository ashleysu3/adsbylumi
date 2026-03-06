

## Plan: Move Performance History & Past Reports into Data Page

### Problem
Performance History and Past Reports are separate sidebar nav items that clutter the navigation. They belong contextually inside the Ad Performance (Data) page.

### Approach
Add two subtle text links below the existing "Generate Report" button area in `InsightsHome.tsx`, giving users access to the same content without polluting the sidebar. Keep the standalone pages and routes intact (they still work via direct URL), but remove them from sidebar navigation.

### Changes

**1. `src/components/AppSidebar.tsx`** — Remove two items from `createNav`
- Remove the `performance-history` and `past-reports` entries (lines 32-33)
- Remove `TrendingUp` and `FileText` from imports if no longer used elsewhere in the file

**2. `src/components/insights/InsightsHome.tsx`** — Add links near the "Generate Report" button
- After the "Generate Report" button (around line 502), add two small text links:
  - `TrendingUp` icon + "Performance History" → navigates to `/performance-history`
  - `FileText` icon + "Past Reports" → navigates to `/past-reports`
- Style as subtle `text-xs text-muted-foreground hover:text-foreground` inline links, consistent with the existing "Refresh Ad Results" and "Connect Meta" link styling on the page
- Import `TrendingUp` if not already imported

### What stays unchanged
- The `/performance-history` and `/past-reports` routes in `App.tsx` (still accessible via direct URL)
- The standalone page components themselves
- All other sidebar items, pages, and components

