

## Plan: Add Custom Angles + Full Creative Brief Document

### Feature 1: "Add Your Own" Custom Angle

**What it does:** Adds a card in the AngleSelector grid that lets users type their own creative angle idea. Lumi processes it into a proper angle format, asking clarifying questions only if the input is too vague.

**Implementation steps:**

1. **Add "Add Your Own" card to AngleSelector** (`src/components/creative/AngleSelector.tsx`)
   - Add a special card at the end of the angles grid with a `+` icon and "Add Your Own" label
   - Clicking it opens a small dialog/popover with a text input for the user's angle idea
   - On submit, call a new edge function to process the input

2. **Create `generate-custom-angle` edge function** (`supabase/functions/generate-custom-angle/index.ts`)
   - Accepts: user's raw angle idea text, brand context, offer context
   - Uses AI (gemini-2.5-flash) to either:
     - Return a properly formatted angle object (id, name, description) if the input is clear enough
     - Return `{ needsClarification: true, question: "..." }` if the input is too vague
   - The AI decides whether clarification is needed based on specificity of the input

3. **Add clarification dialog** in AngleSelector
   - If the edge function returns `needsClarification`, show a follow-up dialog with Lumi's question
   - User answers, re-submits with original + clarification to the same edge function
   - Once resolved, the custom angle is appended to `availableAngles` and auto-selected

4. **Mark custom angles visually** with a small "Custom" badge so users can distinguish them from AI-generated ones

5. **Persist custom angles** — they save to `creative_json.angles` alongside AI-generated ones via the existing `saveCreativeState` mechanism

### Feature 2: Creative Brief Document for Agencies

**What it does:** A comprehensive, client-facing creative brief document (not just the CSV export) that includes offer context, psychology, angles, concepts, and ad copy in a polished format.

**Implementation steps:**

1. **Create `CreativeBriefDocument` component** (`src/components/creative/CreativeBriefDocument.tsx`)
   - A full-page printable/exportable document with sections:
     - **Offer Overview**: name, URL, price, description
     - **Offer Psychology**: product psychology, audience psychology, pain points, desires
     - **Creative Angles**: each selected angle with its description and psychology trigger
     - **Creative Concepts**: grouped by angle — hook, format, guidance, why it works
     - **Ad Copy**: headlines, descriptions, primary copy per angle
   - Styled for print with clean typography

2. **Add "Creative Brief" button to the Creative Studio toolbar** (`src/pages/CreativeStudio.tsx`)
   - Visible once concepts have been generated (after the angles step)
   - Opens a dialog/sheet showing the brief with a "Print / Save as PDF" button and a "Download CSV" option (reuses existing CSV export)

3. **Add print-friendly styles** — use `@media print` CSS rules in the component for clean PDF output via browser print

4. **Gate behind agency tier** (optional enhancement) — show for all users but highlight as an "Agency Pro" feature in the UI

### Files to create:
- `supabase/functions/generate-custom-angle/index.ts`
- `src/components/creative/CreativeBriefDocument.tsx`

### Files to modify:
- `src/components/creative/AngleSelector.tsx` — add custom angle card + input dialog + clarification dialog
- `src/pages/CreativeStudio.tsx` — add Creative Brief button to toolbar, pass new props to AngleSelector for custom angle handling, wire up brief dialog

