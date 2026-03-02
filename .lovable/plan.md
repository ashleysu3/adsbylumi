

## Plan: Production Checklist Smart Management for Creative Refresh

### The Problem
1. When generating fresh angles (via refresh or regenerate), old production items persist — creating a huge, disorganized list mixing old and new concepts.
2. There's no visual separation between "rounds" of creative generation, making it hard to tell what's new vs. old.

### What We'll Build

**A. Tag production items with a generation round**
- When `generateAngles` runs, stamp a `round` identifier (e.g., timestamp) into `creative_json`.
- When `addToChecklist` creates a production item, attach the current round ID.
- This lets us group/filter items by generation batch.

**B. Add a "Previous Rounds" collapsible section in the Concepts tab's checklist and the Build tab**
- Current-round items show prominently at the top.
- Previous-round items collapse under a "Previous Batches" accordion with a count badge.
- Each batch shows a small label like "Round from Feb 28" so users can identify them.

**C. Add a "Lumi: Curate My Checklist" button**
- Appears when the user has 6+ production items and performance data is available.
- Calls the existing `analyze-past-creatives` performance context to rank which existing production items best match what's been working.
- Returns a recommended subset (starred/highlighted) and suggests archiving the rest.
- User can accept or dismiss the recommendations.

**D. Quick actions: Archive / Clear Old Items**
- "Archive Previous Rounds" button that moves old-round items to a `archived_production_items` field in creative_json, removing clutter.
- "Clear All & Start Fresh" option during regeneration confirmation that wipes production items.

### Files Changed

1. **`src/pages/CreativeStudio.tsx`**
   - Add `currentRound` state derived from `creative_json.currentRound`.
   - In `generateAngles`: set a new `currentRound` timestamp in creative_json.
   - In `addToChecklist`: tag new items with `round: currentRound`.
   - Split production items into `currentRoundItems` and `previousRoundItems` using the round tag.
   - Add "Archive Previous" and "Lumi: Curate" buttons above the checklist in the Build tab.
   - Add collapsible "Previous Batches" section.

2. **`src/components/creative/ProductionManager.tsx`** (or wherever the Build tab renders checklist items)
   - Accept `currentRound` prop.
   - Render items grouped by round with collapsible previous section.

3. **`supabase/functions/rank-creative-concepts/index.ts`** (existing file — enhance or create new logic)
   - Accept production items + performance context.
   - Return ranked items with a `recommended` flag and reasoning.

### Technical Details

```text
creative_json shape addition:
{
  currentRound: "2026-03-02T14:00:00Z",
  archivedProductionItems: [...],  // items from cleared rounds
}

ProductionItem shape addition:
{
  round?: string;  // ISO timestamp of the generation round
}
```

The round-based grouping uses simple timestamp comparison — items without a `round` field are treated as "legacy" and grouped under previous batches.

The "Curate" feature sends production items + the workspace's cached `performanceContext` (from the refresh dialog) to an edge function that uses AI to rank which concepts best match proven patterns, returning `{ recommended: string[], reasoning: string }`.

