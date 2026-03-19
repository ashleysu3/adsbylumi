

## Two Issues to Fix

### Issue 1: LUMI Assumes the User Experienced the Results

**Problem**: The AI prompts in `generate-creative-angles`, `generate-creative-grid`, and `generate-angle-copy` don't distinguish between the user (brand owner) and their customers. When the AI generates hooks like "I lost 20 lbs using this method," it frames the user as the one who experienced the transformation — but in most cases, it's their *customers* who had those results. The user is the coach/service provider selling the offer.

**Fix**: Add a clear directive to the system prompts in all three edge functions:

- **`generate-creative-angles/index.ts`** (line ~190): Add a section to the system prompt clarifying the user is the SELLER, not the BUYER. Their customers experienced the results. Scripts should use "my client" / "my students" framing, not "I experienced this."
  
- **`generate-creative-grid/index.ts`** (line ~135): Same directive — hooks and scripts should frame the user as the expert/provider sharing their clients' transformations, not their own.
  
- **`generate-angle-copy/index.ts`** (line ~147): Same directive for ad copy — primary text should reference client results ("My clients...", "She went from...") rather than assuming the user personally experienced the transformation.

The directive will read something like:

> CRITICAL PERSPECTIVE RULE: The person recording/posting these ads is the BUSINESS OWNER — a coach, course creator, or service provider. They are NOT the person who experienced the transformation. Their CUSTOMERS/CLIENTS are the ones who got results. Frame scripts accordingly: "My client went from..." or "One of my students..." — NOT "I went from..." unless it's clearly the founder's own origin story. When referencing testimonials, attribute them to clients. The user sells the solution; their customers experienced the results.

---

### Issue 2: Production Checklist Expanded View Missing CSV-Only Info

**Problem**: The `CreativeChecklistCard` expanded view already shows talking head details well (verbal/written/visual hooks, scripts, text overlays, delivery style, psychology). However, for `broll` and `graphic` formats, the expanded view shows only generic tips ("Capture variety", "Keep text minimal") instead of the item-specific data that exists in the CSV export: text overlays, visual direction, and why-it-works psychology.

**Fix**: Update `CreativeChecklistCard.tsx` to show item-specific data for ALL formats, not just talking heads:

- **B-Roll items**: Show `text_overlays`, `visual_hook`/`guidance` as "Visual Direction", and `why_this_works` psychology — replacing or supplementing the generic "B-Roll Tips" list.
  
- **Graphic items**: Show `text_overlays` (as "Graphic Copy"), `guidance` as "Design Direction", and `why_this_works` — replacing or supplementing the generic "Design Tips" list.

This means extracting the talking-head-only sections (text overlays, psychology card) into shared sections that render for ALL formats when the data exists. The generic tips can remain as fallbacks when item-specific data isn't available.

**Files changed**: `src/components/creative/CreativeChecklistCard.tsx` (~40 lines moved/restructured)

---

### Summary

| Change | Files | Scope |
|--------|-------|-------|
| Add seller-vs-customer perspective directive | 3 edge functions | ~5 lines each |
| Show full item data for all formats in checklist | `CreativeChecklistCard.tsx` | ~40 lines restructured |

