

# Simplify Missing Info UX in Offer Creation

## Problem
When the page extraction finds missing info, the current UI creates confusion in three ways:
1. A yellow warning box lists clarification questions at the top
2. The collapsible "View extracted details" section also lists "Missing Info" (read-only)
3. The actual editable fields are further down with small red text

Users naturally try to fix things where the warning appears, but that section isn't editable. The real fields to fill in are below and easy to miss.

## Solution
Consolidate the experience so missing fields are highlighted directly where the user can act on them -- no separate warning list needed.

### Changes to `src/components/OfferDialog.tsx`

1. **Remove the yellow clarification questions box** (lines 352-369) -- this warning block lists questions the user can't answer in-place, creating confusion.

2. **Remove "Missing Info" from the collapsible extracted details** (lines 439-448) -- redundant with the inline field indicators.

3. **Make the inline missing-field indicators more prominent** -- instead of small red text below empty fields, show a warm highlighted label next to the field name (e.g., an amber "Needs info" badge beside the Label) so it's immediately clear which fields need attention without a separate warning section.

4. **Simplify the extraction status message** -- when `needs_clarification` is true, change the status text from "Limited extraction" to something like "Almost there -- a few fields below need your input" so the user knows exactly where to look.

### What the user sees after this change

- URL is pasted, extraction runs
- Status shows "Almost there -- a few fields below need your input"
- Extracted details remain expandable for curious users (benefits, hooks, etc.) but no longer list "Missing Info"
- Empty required fields show an amber "Needs info" badge next to the label, drawing the eye directly to where to type
- No separate warning block to read and then scroll past

