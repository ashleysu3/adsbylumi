

## Plan: Upgrade Advanced Build Copy System

### Problem
1. Copy quality is generic — doesn't leverage offer psychology, brand voice, emojis, or proper formatting
2. Current model generates copy per-asset (redundant) — should generate ONE shared set of variations for all creatives
3. Each creative still needs its own ad, just sharing the same approved copy variations

### Changes

#### 1. Upgrade `generate-advanced-copy` edge function
- Fetch knowledge base docs (copy formulas, psychology triggers, meta best practices) to inject into the prompt
- Include full offer psychology, audience psychology, messaging guidelines, brand emojis, copy perspective (I/We), and never-use words
- Rewrite the system prompt to enforce: emoji usage, proper spacing (hook → blank line → short paragraphs), psychology-driven angles, brand voice matching
- Enforce headline ≤25 chars, description ≤27 chars
- Remove `assetFilename`/`assetType` params since copy is no longer per-asset
- Add `brandEmojis`, `bulletEmoji`, `useEmojis`, `copyPerspective`, `neverUseWords`, `messagingGuidelines` to the request body

#### 2. Refactor `AdvancedBuild.tsx` — shared copy model
- Replace per-asset `assetCopy` state with a single shared `sharedCopy` state: `{ variations: CopyVariation[], selectedIndices: number[], generating: boolean }`
- Step 2 becomes a single card: "Let Lumi Write Copy" generates ONE set of 5 variations for the campaign
- Users can select/approve multiple variations (checkboxes instead of single select) — all approved variations are used in every ad
- Each creative in the review step shows the same approved copy set
- Update `canProceedToStep3` to check that at least one variation is approved
- Update `handlePublish` and `saveState` to use the shared copy model
- Update the Lumi intro text to reflect the new model: "I'll write 5 psychology-driven copy variations for your campaign. Each of your creatives will be deployed as its own ad using these same variations."

#### 3. Update review step (Step 3)
- Show the shared copy variations at the top
- Show the list of creative assets below, each labeled as its own ad
- Clarify: "X ads will be created — one per creative, each with Y approved copy variations"

### Files Modified
- `supabase/functions/generate-advanced-copy/index.ts` — enhanced prompt + KB integration
- `src/pages/AdvancedBuild.tsx` — shared copy model, multi-select variations, updated UI

