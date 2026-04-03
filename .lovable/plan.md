

# Fix B-Roll Creative Direction — Make It Lofi, Not Produced

## Problem
The b-roll column in the creative grid generates over-produced, cinematic directions because:
1. The column description says "cinematic micro-moments" (line 222)
2. There are **zero** dedicated b-roll format instructions — talking_head has 100+ lines of format guidance, but b-roll has nothing
3. The `regenerate-creative-cell` function also labels b-roll as "cinematic micro-moments" (line 66)
4. Without explicit rules, the AI defaults to stylized, produced suggestions

## Solution
Add a dedicated **B-Roll Format Section** to the creative grid prompt (same level of detail as talking_head gets) that enforces lofi, everyday, phone-filmed aesthetics. Update the column description and all related prompts.

## Changes

### 1. `supabase/functions/generate-creative-grid/index.ts`

**Line 222** — Change column description from "cinematic micro-moments" to "lofi everyday footage with text overlaid on top":
```
"broll" - B-roll with text overlay (lofi, everyday, phone-filmed — the copy does the selling)
```

**After the talking_head section (~line 320)** — Add a new `=== B-ROLL FORMAT ===` block with:
- **Philosophy**: B-roll is background footage that text/copy gets layered on. The viewer reads the copy, not watches the footage. It should feel like a friend filmed it on their phone.
- **What to suggest**: Only generic everyday actions — pouring coffee, typing on laptop, walking somewhere, fixing hair, petting the dog, driving, getting ready, putting on shoes, cooking, scrolling phone, sitting at a desk
- **What NOT to suggest**: No industry-specific scenes, no cinematic shots, no props they'd need to buy, no specific facial expressions or acting, no elaborate staging
- **Required output fields for broll cells**:
  - `broll_shots`: Array of 3-5 one-sentence everyday shot ideas
  - `text_overlays`: Array of text overlay lines timed to the shots (this is what sells — the footage is just warmth)
  - `mood`: One of Calm, Productive, Relatable, Warm, Authentic, Energetic
- **Examples**: "Film yourself pouring coffee into a mug, phone propped on counter" / "Walk down a sidewalk, natural pace, phone at chest height" / "Type on your laptop with natural light from a window"

### 2. `supabase/functions/regenerate-creative-cell/index.ts`

**Line 66** — Change format label from "cinematic micro-moments" to match the new lofi description.

**After line 149** (end of talking_head block) — Add a parallel `isBroll` block with the same lofi rules and required output fields, so regenerated b-roll cells also follow the new philosophy.

### 3. `supabase/functions/expand-creative/index.ts`

Update the b-roll references in the expand prompt (~line 238, 272) to specify lofi everyday footage directions rather than "visual guidelines" style cinematic suggestions.

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/generate-creative-grid/index.ts` | New B-Roll format section + update column label |
| `supabase/functions/regenerate-creative-cell/index.ts` | Update format label + add broll-specific prompt block |
| `supabase/functions/expand-creative/index.ts` | Update broll instruction references |

## Technical Notes
- No database or UI changes needed — this is purely prompt engineering across 3 edge functions
- The B-Roll Tab in Creative Toolkit already has the right philosophy (lofi, everyday, generic) — we're aligning the creative grid generation to match
- The new b-roll output fields (`broll_shots`, `text_overlays`, `mood`) will be consumed by the existing `ProductionWorkflow.tsx` which already renders `broll_instructions`

