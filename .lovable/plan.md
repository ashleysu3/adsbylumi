

## Plan: Redesign the "Target Outcome" field in OfferDialog and OfferEditDialog

### Problem
The current "Target Outcome" field is a single-line text input with vague labeling. Users don't understand what it means or why it matters for ad creation. The data often ends up as one long run-on sentence.

### Solution
Replace the single input with a structured two-field layout using a clear, intuitive label and helper text that connects it to the ad creation process.

### Changes

**1. OfferDialog.tsx (lines 641-665) — New offer creation**

Replace the single "Target Outcome" `Input` with:

- **New label**: "Before & After" (with a small helper line: "This powers your ad copy — what's life like before and after your offer?")
- **Two stacked `Textarea` fields**:
  - **"Before"** — placeholder: "What are they struggling with right now?" (2 rows)
  - **"After"** — placeholder: "What does life look like after they buy?" (2 rows)
- On save, concatenate as `"Before: {before}. After: {after}."` into the existing `target_outcome` column (no DB change needed)
- On load (when auto-filled from crawler), parse the existing `"Before: ... After: ..."` format back into the two fields

**2. OfferEditDialog.tsx (lines ~125-135) — Edit existing offer**

Same two-field layout. Parse the stored `target_outcome` string on load into before/after fields.

**3. No database changes** — the `target_outcome` column remains a text field; we just structure the UI input and format the stored string consistently.

### UI Details
- Small muted hint below the label: *"Lumi uses this to write ads that speak to your audience's real experience"*
- Each textarea gets a subtle emoji prefix in the label: "😩 Before" / "✨ After"
- Keeps the auto-filled badge and "Needs info" badge logic intact

