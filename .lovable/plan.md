

## Plan: Lumi Summary Card, Simple View, and Double $ Fix

### Issues

1. **Double `$` on budget badge** — Line 691-692: A `<DollarSign>` icon AND a literal `$` in the template string produce `$ $30.00/day`. Remove the icon.

2. **Lumi Recommendations card should become a high-level summary** — Replace the current automatable-actions card at the top with a warm, conversational summary of the user's ad performance (using the existing `lumiSummary` logic that's already computed but not displayed). Kind, optimistic, plain-language — tells the user what's happening and what to do next. No jargon.

3. **Simple vs Detailed view toggle** — Add a toggle (e.g., "Simple / Detailed") that switches between:
   - **Simple view**: Campaign cards show plain-language status ("Your ads are doing great!", "Needs attention", "Not performing well"), total spend, and a single recommended action button. No KPI strips, no CTR/ROAS/Frequency numbers.
   - **Detailed view**: Current layout with KPI strips, goal editing, metrics, and inline recommendations (what exists now).

### Implementation

**File: `src/components/insights/InsightsHome.tsx`**

1. **Fix double `$`** (line 691-692): Remove `<DollarSign className="h-3 w-3" />` icon, keep the `$` in the text string.

2. **Replace Lumi Recommendations section** (lines 595-608): Instead of `<LumiRecommendations>` with automatable actions, render a friendly summary card:
   - Uses the existing `lumiSummary` string (already computed at line 493)
   - Shows a Sparkles icon, "Here's what Lumi sees" header, and the conversational summary text
   - Warm gradient border, rounded card, simple and inviting

3. **Add Simple/Detailed view toggle**:
   - New state: `const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple')`
   - Render a small toggle near the status filter area
   - **Simple mode campaign card**: Shows campaign name, status dot, live/paused toggle, spend amount, and a single plain-language verdict badge (maps green→"Doing great", amber→"Keep an eye on this", red→"Needs a refresh", no-data→"Still warming up"). Plus one action button. No KPI strip, no inline recs.
   - **Detailed mode campaign card**: Exactly what exists now (KPI strip, goal editor, action rec, inline recs)

### Key Design Decisions

- Default to **simple** view to align with the non-expert creator audience
- The summary card replaces the `LumiRecommendations` component at the top — per-campaign recs stay on each card in detailed view
- Simple view verdicts use warm, encouraging language per the conversational style memory
- The toggle persists in component state only (no localStorage needed for now)

