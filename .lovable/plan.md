

## Plan: Smart Creative Refresh Flow from Recommendations

When a "create_creative" recommendation's "Next Step" button is clicked, the current behavior just dumps the user at `/creative` with no context. This needs three changes:

### 1. Pass workspace ID in the navigation URL
**Files:** `src/components/insights/InsightsHome.tsx`, `src/components/insights/LumiRecommendations.tsx`

- Update fallback `create_creative` recommendations (line 248) to include `actionUrl: '/creative?workspace=${campaign.id}&refreshCreative=true'` instead of just `/creative`
- For AI-generated recommendations of type `create_creative`, also inject the `campaignId` into the `actionUrl`

### 2. Create a Creative Refresh Dialog
**File:** `src/components/creative/CreativeRefreshDialog.tsx` (new)

A dialog that appears when `refreshCreative=true` is in the URL params. It presents two clear options:

- **"Build on what's working"** — Shows top performing ads from the campaign + account (30/60/90 day data via the existing `analyze-past-creatives` edge function), lets user generate similar angles/formats
- **"Start fresh with new angles"** — Goes straight to angle generation as usual

The dialog fetches performance data using the existing `analyze-past-creatives` function and displays:
- Top performing ad names/formats from this campaign
- Top performers across the account
- Key patterns identified (formats, hooks that work)

### 3. Wire it into Creative.tsx
**File:** `src/pages/Creative.tsx`

- Detect `refreshCreative=true` search param
- Auto-load the workspace for that campaign
- Show the `CreativeRefreshDialog` on mount
- If user chooses "build on what's working," pass the performance context into angle generation (the existing `generate-creative-angles` function already accepts performance context)
- If user chooses "start fresh," proceed normally

### Technical Details

- `CreativeRefreshDialog` calls `supabase.functions.invoke('analyze-past-creatives')` with the brand ID
- Dialog shows a loading state while fetching, then renders performance summary + two action buttons
- When "build on what's working" is chosen, the performance patterns are stored in workspace `creative_json.performanceContext` and passed to angle generation
- The `refreshCreative` param is cleared from URL after dialog interaction
- No new edge functions needed — reuses `analyze-past-creatives`

