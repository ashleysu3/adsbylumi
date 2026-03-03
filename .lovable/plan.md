

## Plan: Split Recommendations Between Campaign Cards and Lumi Card

### Problem
Currently all recommendations (both user-action items like "refresh creative" and automatable items like "scale budget") live in the Lumi Recommendations card. The user wants:
- **User-action recommendations** (creative refresh, add posts, try new angles) shown directly on each campaign card
- **Lumi Recommendations card** reserved for things Lumi can execute automatically (budget changes, ad pause/resume, bench swaps)
- Button labels should be specific ("Refresh Creative", "Add New Posts") not generic "Next Step"

### Changes

#### 1. `src/components/insights/InsightsHome.tsx` — Show per-campaign action tips on cards + filter Lumi card

- After fetching recommendations, split them into two buckets:
  - **Automatable** (`budget_increase`, `budget_decrease`, `pause_ad`, `resume_ad`, `swap_creative`) → stay in `LumiRecommendations` card
  - **User-action** (`create_creative`, `keep_running`, or any with `userAction: true`) → stored per-campaign and rendered inline on the campaign card
- On each campaign card (Row 3 area), if there's a user-action rec for that campaign, show a small inline recommendation row with a specific button label derived from the rec type/title:
  - If title contains "resonating" or "CTR" → "Add New Posts" linking to selectPosts flow
  - If title contains "fatigue" or "cost per purchase" or "refresh" → "Refresh Creative" linking to refreshCreative flow
  - Fallback → "Try New Angles"
- Pass only automatable recs to `<LumiRecommendations>`; hide the card entirely if none exist

#### 2. `src/components/insights/LumiRecommendations.tsx` — Minor cleanup

- Remove `create_creative` and other user-action types from this component's rendering since they'll live on campaign cards
- The "Next Step" button path is no longer needed here — all items in Lumi Recommendations will have "Approve" buttons

#### 3. `src/components/insights/CampaignInsightDetail.tsx` — Same split on detail page

- Filter the recommendations passed to `<LumiRecommendations>` to only automatable types
- Show user-action recs inline above/below the summary cards with specific action buttons

### Files to edit
- `src/components/insights/InsightsHome.tsx`
- `src/components/insights/LumiRecommendations.tsx`
- `src/components/insights/CampaignInsightDetail.tsx`

