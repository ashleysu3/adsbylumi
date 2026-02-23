

# Deep Creative Analysis + Actionable Recommendations in Results Dashboard

## Overview

Three connected improvements to the Results dashboard and Creative Studio:

1. **Enhanced "What's Working" analysis** — Pull actual ad-level performance data from Meta (via the existing `analyze-past-creatives` edge function) and feed it into the `generate-trend-insights` function so the AI analyzes *real performance data*, not just creative bench snapshots. This includes cross-campaign pattern detection (e.g., "talking head videos outperform graphics across all your campaigns").

2. **"Add to Production Checklist" buttons** on each creative recommendation — so users can send recommendations directly to their Creative Studio production checklist with one click.

3. **Auto-save verification** — Confirm and strengthen the existing auto-save mechanism in Creative Studio so users can leave and return to the exact same state (angles, grid, copy, production items).

---

## What Changes

### 1. Enhanced Edge Function: `generate-trend-insights`

Currently this function only looks at `creative_bench` data (which may be empty). We will enhance it to:

- Call the Meta API directly (like `analyze-past-creatives` already does) to fetch ad-level insights for the last 90 days
- Include ad names, CTR, CPC, ROAS, spend, reach, and conversion data
- Also fetch ad creative details (thumbnail URLs, format type inferred from naming conventions)
- Feed ALL of this into the AI prompt so it can identify:
  - Which **formats** work best (talking head vs. static vs. carousel vs. UGC)
  - Which **hooks/messaging patterns** appear in top performers
  - Which **psychology triggers** resonate with the audience
  - Cross-campaign patterns (same format winning across different objectives)
  - What specifically does NOT work and why
- Return enhanced recommendation objects that include enough detail to be added to a production checklist:
  ```
  recommendations: [{
    idea: string,
    format: "talking_head" | "static" | "carousel" | "ugc" | "graphic",
    hook_suggestion: string,
    psychology_trigger: string,
    guidance: string,        // NEW: production guidance
    why_it_works: string,    // NEW: explanation of the psychology
    based_on: string,        // NEW: which top performer inspired this
  }]
  ```

### 2. Updated Component: `WhatsWorkingCard.tsx`

- Add an "Add to Checklist" button on each recommendation card
- When clicked, save the recommendation to the `content_ideas` table as a `creative_concept` with type `recommendation` and relevant tags
- Also show a "Add All to Checklist" bulk action button
- The button navigates to Creative Studio after saving, or shows a success toast with a link
- Pass `workspaceId` (optional) so recommendations can be tied to a specific campaign workspace

### 3. Updated Component: `InsightsHome.tsx` and `CampaignInsightDetail.tsx`

- Pass `workspaceId` to `WhatsWorkingCard` when viewing from a campaign detail
- The WhatsWorkingCard already appears in `CampaignInsightDetail` — just needs the workspace ID forwarded

### 4. Auto-Save Verification in Creative Studio

The existing auto-save system already persists:
- `availableAngles` via `creative_json.angles`
- `selectedAngleIds` via debounced save (800ms)
- `gridData` via `creative_json.gridData`
- `productionItems` via `production_items` column
- `angleCopy` via `creative_json.angle_copy`
- `lastActiveTab` via `creative_json.lastActiveTab`

This is already working. The one gap is that `creativeIntelligence` data (the past-performance analysis) is cached in `creative_json.creativeIntelligence` but recommendations from the Results dashboard are separate. We will ensure:
- Recommendations saved from Results go to `content_ideas` table (already the pattern used by "Save for Later")
- Creative Studio already loads `content_ideas` on init and displays them
- No additional auto-save changes needed — the system already persists everything

---

## Technical Details

### Edge Function Changes: `generate-trend-insights/index.ts`

- Add Meta API calls to fetch ad-level insights (similar to `analyze-past-creatives`)
- Fetch brand's `meta_account_id` and `meta_access_token`
- Pull last 90 days of ad data with `spend > $10` and `reach >= 500`
- Also fetch ad creative specs to detect format types from naming patterns
- Merge this real data with existing `creative_bench` data
- Expand the AI prompt to analyze real ad performance and produce richer recommendations
- Add new fields to the `suggest_trends` tool schema: `guidance`, `why_it_works`, `based_on`

### Component Changes: `WhatsWorkingCard.tsx`

- Accept optional `workspaceId` prop
- Add `brandId` to each recommendation card's action area:
  - "Add to Checklist" button (Plus icon)
  - Inserts into `content_ideas` table with:
    - `brand_id`: from props
    - `title`: recommendation idea
    - `content`: JSON with format, hook, guidance, psychology trigger, why_it_works
    - `type`: "creative_concept"
    - `status`: "idea"
    - `tags`: [format, "from-insights", psychology_trigger]
  - Toast: "Added to your creative ideas — find it in Creative Studio"
- Add "Add All" button below the recommendations list
- Update "Create More Like This" button to also pass performance context via URL params

### Component Changes: `CampaignInsightDetail.tsx`

- Pass `campaign.id` as `workspaceId` to `WhatsWorkingCard`

### Files Modified

1. `supabase/functions/generate-trend-insights/index.ts` — Add Meta API data fetching and enhanced AI prompt
2. `src/components/insights/WhatsWorkingCard.tsx` — Add "Add to Checklist" buttons, accept workspaceId prop, enhanced recommendation display
3. `src/components/insights/CampaignInsightDetail.tsx` — Forward workspaceId to WhatsWorkingCard

