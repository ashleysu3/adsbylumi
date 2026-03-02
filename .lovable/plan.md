

## Plan: Fix Creative Refresh Flow + Enhance Ad Analysis + Add Format-Prefixed Ad Naming

Three issues to address:

### 1. Fix "Build on What's Working" flow tapping out

**Problem:** After clicking "Build on what's working," the performance context gets saved to the workspace, then `generateAngles()` is called. But `generateAngles` reads performance context from `workspace.creative_json.performanceContext` — however the `workspace` state object hasn't been updated yet at the time `generateAngles` runs (React state updates are async). So it generates angles without the performance context, and since it works fine otherwise, the real bug is likely that the workspace hasn't loaded its `strategy_json` yet for a refresh-mode workspace, causing the early return at line 329.

**File:** `src/pages/Creative.tsx` (lines 1288-1311)

- Pass performance context directly to `generateAngles` as a parameter instead of relying on stale workspace state
- Change `generateAngles` signature to accept an optional `performanceOverride` parameter
- Use that override in the edge function call body

### 2. Enhance `analyze-past-creatives` to also fetch and analyze ad copy

**File:** `supabase/functions/analyze-past-creatives/index.ts`

Currently the function only fetches `ad_name` and metrics. It needs to also fetch the actual ad copy (primary text, headline, description) from the ad creative objects to analyze angle/copy types, not just naming patterns.

- Expand the Meta API `ads` fetch to include `creative{effective_object_story_spec}` which contains the actual copy fields (message, name/headline, description)
- Pass ad copy content alongside ad names to the AI analysis prompt
- Update the AI prompt to analyze copy patterns (pain point angles, transformation stories, authority proof, etc.) in addition to format patterns from names

### 3. Add format-prefixed naming convention for Lumi-uploaded ads

**File:** `supabase/functions/build-meta-campaign/index.ts` (line 590)

Current naming: `Ad ${i + 1} - ${hookLabel || title}`

New naming convention based on the concept's format:
- `G - [descriptor]` for graphic format
- `V - [descriptor]` for video/talking head format  
- `BR - [descriptor]` for b-roll format

Change line 590 to derive the prefix from the production item's linked asset type or the concept's format field, then use the concept's hookLabel or title as the descriptor.

### Technical Details

**`generateAngles` parameter fix (Creative.tsx):**
```
const generateAngles = async (performanceOverride?: any) => {
  // ... existing code ...
  const performanceContext = performanceOverride || workspace.creative_json?.performanceContext || null;
  // ... rest unchanged ...
}
```

Then in `onBuildOnWhatWorks`:
```
generateAngles(performanceContext);
```

**Ad copy fetch (analyze-past-creatives):**
Add `effective_object_story_spec` to the ads query, extract `message` (primary text), `name` (headline), `description` from `link_data` or `video_data`, and include in the enriched ads passed to AI.

**Ad naming (build-meta-campaign):**
```
const formatPrefix = assetType === 'video' ? 'V' : 'G';
const adName = `${formatPrefix} - ${item.concept?.hookLabel || item.concept?.title || 'Creative'}`;
```

