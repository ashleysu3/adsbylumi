

## Make Perspective a User Choice, Not a Hard Rule

### What Changes

**1. Add a "Who experienced the results?" question to the pre-generation context UI**

In `CreativeContextInput.tsx`, add a new radio group question (always visible, not inside the collapsible) asking:

> **Who experienced the results from your offer?**
> - **My customers/clients** — "I help others get results" (coach, agency, service provider)
> - **Me personally** — "I experienced the transformation myself" (founder story, personal brand)
> - **Both** — "I got results AND so do my clients"

This gets stored in the `CreativeContext` interface as a new `perspectiveRole` field (`"seller"` | `"buyer"` | `"both"`).

**2. Update `CreativeContext` interface**

Add `perspectiveRole: "seller" | "buyer" | "both"` to the interface exported from `CreativeContextInput.tsx`.

**3. Pass perspective through to edge functions**

In `CreativeStudio.tsx`, the `preGenerationContext` already flows to all three edge functions. No additional wiring needed — the new field travels with the existing context object.

**4. Replace hard-coded perspective rule in 3 edge functions**

In `generate-creative-angles`, `generate-creative-grid`, and `generate-angle-copy`:

- Read `preGenerationContext.perspectiveRole` 
- If `"seller"`: Use the current directive (frame as client results)
- If `"buyer"`: Frame as personal experience ("I went from...")
- If `"both"`: Allow both framings, mixing personal story with client results
- If not set (legacy workspaces): Default to current seller framing as a reasonable default

### Files Changed

| File | Change |
|------|--------|
| `src/components/creative/CreativeContextInput.tsx` | Add radio group for perspective, update interface |
| `supabase/functions/generate-creative-angles/index.ts` | Dynamic perspective rule based on context |
| `supabase/functions/generate-creative-grid/index.ts` | Same dynamic rule |
| `supabase/functions/generate-angle-copy/index.ts` | Same dynamic rule |

