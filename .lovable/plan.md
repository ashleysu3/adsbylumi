

## Plan: Recommendation Badges on Campaign Cards + Enhanced Detail View

### Overview
Add a per-campaign recommendation count badge on each campaign card in the Results overview, and enhance the detail view to show recommendations prominently below the date range. Recommendations are split into two types: **Lumi-executable** (approve and Lumi does it) and **user-action** (button takes user to the right place).

### Changes

#### 1. `src/components/insights/InsightsHome.tsx`
- **Track per-campaign recommendation counts** during the existing `fetchRecommendations` loop. Store a `Map<campaignId, number>` in state.
- **Add a recommendation badge** on each campaign card (next to the campaign name or near the "View Details" button). Shows a small Sparkles icon + count (e.g., "3 recommendations"). Clicking it calls `onViewInsights(campaignId)`.
- Pass a `scrollToRecs` flag when the badge is clicked vs the "View Details" button.

#### 2. `src/components/insights/LumiRecommendations.tsx`
- **Add a new recommendation type: `'create_creative'`** for user-action items (things Lumi can't do automatically, like making new creative).
- For each recommendation, if the type is user-actionable (not automatable), render a **"Next Step"** button instead of "Approve" that navigates the user to the appropriate page (e.g., `/creative?workspace=...&addCreative=true` for creative refresh).
- Add a `userActionTypes` set: `{'create_creative', 'record_new_video', ...}` — these render navigation buttons instead of approve buttons.

#### 3. `src/components/insights/CampaignInsightDetail.tsx`
- **Move `LumiRecommendations` to directly below the date range card** (currently it's after the 3 summary cards). This puts recommendations front and center.
- Keep "Approve All" and individual approve buttons as-is for Lumi-executable actions.

#### 4. `supabase/functions/generate-recommendations/index.ts`
- **Add a `create_creative` recommendation** when creative fatigue is detected but no bench items are available. Include a `userAction: true` flag and `actionUrl` in the payload pointing to `/creative?workspace=...&addCreative=true`.
- Add `userAction` boolean and `actionUrl` string to the Recommendation interface so the frontend knows whether to show "Approve" vs "Next Step →".

### Technical Detail

**Recommendation interface addition:**
```typescript
interface Recommendation {
  // ... existing fields
  userAction?: boolean;    // true = user must do something (navigate)
  actionUrl?: string;      // where to send them
}
```

**Badge on campaign card** — small inline element:
```
[Sparkles icon] 3 recommendations
```
Styled as a clickable badge with the lumi gradient, placed in Row 4 next to "View Details".

**Detail view layout order** (after changes):
1. Back button
2. Campaign header
3. Link Offer section
4. Date range picker
5. **Lumi Recommendations** (moved up from below summary cards)
6. 3 Summary cards
7. Budget recommendation
8. Primary KPI
9. Ad breakdown
10. Creative bench
11. Advanced analysis

