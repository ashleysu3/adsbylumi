

## Plan: Unify "What To Do Next" with Actionable Recommendations

### Problem
The `LumiRecommendations` component uses ad-level metrics that may be empty, showing "Everything looks good" even when the `analyze-performance` function has returned useful `next_steps`. These two systems are disconnected.

### Changes

#### 1. `src/components/insights/CampaignInsightDetail.tsx`
- **Move `LumiRecommendations` back below the 3 summary cards** (after the What's Working / What's Not / What To Do grid).
- **Pass `analysis.next_steps` into `LumiRecommendations`** as a new `nextSteps` prop so they get merged into the recommendation list.
- **Remove the static "What To Do Next" card** from the 3-card grid — replace it with a clickable card that scrolls to / highlights the recommendations section below. The card shows the count of actionable items and acts as a shortcut.

#### 2. `src/components/insights/LumiRecommendations.tsx`
- **Accept a new `nextSteps` prop** (`string[]`) — these are the AI-generated next steps from `analyze-performance`.
- **Convert each `nextStep` into a Recommendation object** with:
  - Type inferred from keywords (e.g., "creative" → `create_creative`, "budget" → `budget_increase`, default → `keep_running`)
  - `userAction: true` with an `actionUrl` pointing to the relevant page (`/creative`, `/planning`, etc.)
  - Each gets an actionable "Next Step →" button
- **Merge these with any ad-level recommendations** from the edge function, deduplicating where possible.
- **Never show "Everything looks good"** if there are next_steps available — only show the green state when both sources are empty.

#### 3. "What To Do Next" summary card becomes a clickable anchor
- Keep the card in the 3-card grid but make it a clickable summary showing recommendation count.
- Clicking it scrolls to the `LumiRecommendations` section below.
- Add a `ref` on the recommendations section and use `scrollIntoView` on click.

### Layout Order (after changes)
1. Back button + Campaign header
2. Link Offer section
3. Date range picker
4. 3 Summary cards: What's Working | What's Not Working | What To Do Next (clickable, shows count)
5. **Lumi Recommendations** (merged: ad-level recs + next_steps as actionable items)
6. Budget Recommendation
7. Primary KPI
8. Ad Breakdown
9. Creative Bench
10. What's Working Card
11. Advanced Analysis

