

# Leverage Content Library for Testimonial-Driven Ads

## What Changes

All three creative generation edge functions already fetch content assets (testimonials, survey responses, etc.) and inject them into the AI prompt. However, they don't explicitly instruct the AI to:

1. Generate **testimonial screenshot ad concepts** as a specific creative format
2. Use testimonial quotes **verbatim as ad copy** (not just inspiration)
3. Suggest the "screenshot-style" testimonial creative treatment (DM/text message aesthetic over a brand color or texture)

This plan adds explicit instructions for testimonial-driven creative and copy across all three generation functions.

## Changes

### 1. `generate-creative-angles/index.ts` — Add "Testimonial Proof" angle type

In the "ANGLE TYPES TO CONSIDER" list (line ~167), add a dedicated testimonial angle type so the AI knows to generate a testimonial-focused angle when testimonials exist:

```
- Testimonial Proof (real client words, screenshot-style social proof)
```

Add conditional logic: when testimonials exist in the content assets, include a directive telling the AI to **always include at least one testimonial-driven angle** that uses the client's exact words.

### 2. `generate-creative-grid/index.ts` — Add testimonial screenshot creative format

In the system prompt (around the grid structure and format rules), add instructions for a **testimonial screenshot** creative concept under the "graphic" format column:

```
TESTIMONIAL SCREENSHOT CREATIVE (use when testimonials are available):
- Format: "graphic"
- Present the testimonial as a screenshot of a text/DM conversation
- Overlay on a solid brand color, subtle texture, or lifestyle image
- The testimonial text should be the EXACT client quote (do not rewrite)
- Add a small caption: "Real message from a client" or similar
- Text overlay: just the most powerful 1-2 lines from the testimonial
- This is one of the highest-converting ad formats — real proof in their own words
```

When testimonials exist in content assets, add a directive requiring at least 1-2 grid cells per angle to be testimonial screenshot concepts (in the "trust" row, "graphic" column).

### 3. `generate-angle-copy/index.ts` — Testimonial-as-copy instructions

Add instructions telling the AI to generate at least one primary copy variation per angle that uses a testimonial quote as the **lead hook**, followed by the offer pitch. Example framework:

```
- Testimonial Lead: Open with the exact client quote, then transition to "Here's what [client name] is talking about..." or "This is what happens when..."
```

Also add this to the copy formulas list:
```
- Testimonial Lead: Open with a real client quote verbatim, then build the pitch around their words
```

### 4. Conditional enhancement — only when testimonials exist

All additions are wrapped in a check: `if testimonials content asset exists and has content`. If the user hasn't uploaded testimonials, the prompts remain unchanged. This ensures no empty or forced testimonial concepts when there's nothing to pull from.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-creative-angles/index.ts` | Add testimonial angle type, conditional directive to always include 1 testimonial angle when testimonials exist |
| `supabase/functions/generate-creative-grid/index.ts` | Add testimonial screenshot creative format instructions, require 1-2 testimonial cells per angle in "trust" row when testimonials available |
| `supabase/functions/generate-angle-copy/index.ts` | Add "Testimonial Lead" copy framework, instruct at least 1 primary copy per angle to lead with a real quote |

## Technical Details

### Testimonial Detection Logic (all 3 functions)
```typescript
const hasTestimonials = contentAssets?.some(
  (a: any) => a.asset_type === 'testimonials' && a.content?.trim()
);
```

### Grid Prompt Addition (generate-creative-grid)
When `hasTestimonials` is true, append to the system prompt:
```
=== TESTIMONIAL SCREENSHOT ADS (HIGH-CONVERTING FORMAT) ===
The user has uploaded real client testimonials. For EACH angle, include at least ONE 
"graphic" format cell in the "trust" row that uses a TESTIMONIAL SCREENSHOT concept:

- Use the EXACT client quote from the testimonials above — do NOT rewrite or paraphrase
- Present it as a screenshot of a text message, DM, or comment
- Overlay on a solid brand color background, subtle linen/paper texture, or lifestyle photo
- Add a small label: "Real DM from a client" or "Actual text from [first name]"
- The hook for this cell should be the most impactful line from the testimonial
- guidance should describe the screenshot aesthetic: rounded message bubbles, 
  phone-screen crop, or clean quote card layout
- This format converts extremely well because it looks organic and trustworthy

Also for the "action" row, consider a concept where multiple short testimonial 
snippets are shown in quick succession (carousel or montage style).
```

### Copy Prompt Addition (generate-angle-copy)
When `hasTestimonials` is true, append to copy formulas:
```
- Testimonial Lead: Start with the EXACT client quote as the hook 
  (e.g., "[Quote]" — that's what [Name] said after [X]). 
  Then build the pitch around their experience. This uses the 
  ideal customer's exact words, which is one of the most powerful 
  copywriting techniques because prospects see themselves in the quote.

For at least 1 primary copy variation per angle, lead with a real 
testimonial quote from the content assets above.
```

### Angles Prompt Addition (generate-creative-angles)
When `hasTestimonials` is true, add to the rules:
```
- MUST include at least 1 angle focused on Testimonial Proof — 
  using real client words and screenshot-style social proof. 
  Pull the strongest quotes from the testimonials provided.
```
