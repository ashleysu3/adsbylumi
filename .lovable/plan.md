

# Creative Studio Improvements — 5 Changes

## 1. Fix Time-Based Content (December Content in February)

**Problem**: The AI generation functions (`generate-creative-angles`, `generate-creative-grid`, `generate-content-ideas`, `generate-angle-copy`) never pass the current date to the AI model. Without knowing what month it is, the LLM may generate seasonally irrelevant content.

**Fix**: Inject the current date into the system/user prompts of these edge functions:
- `supabase/functions/generate-creative-angles/index.ts` — Add `Current date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` to the user prompt, plus a rule: "All creative must be relevant to the current time of year. Do NOT reference holidays, seasons, or events that are not upcoming."
- `supabase/functions/generate-creative-grid/index.ts` — Same date injection in the user prompt
- `supabase/functions/generate-content-ideas/index.ts` — Same
- `supabase/functions/generate-angle-copy/index.ts` — Same
- `supabase/functions/lumi-chat/index.ts` — Add current date to context prompt

## 2. Script Feedback on Talking Head Scripts

**Problem**: Users cannot provide feedback or request changes to individual talking head scripts in the production checklist.

**Fix**: Add a "Give Feedback" button to `CreativeChecklistCard.tsx` that opens a small textarea + regenerate flow:
- Add a "Refine Script" button next to the existing "Copy Script" button
- Clicking opens an inline feedback input (textarea + "Regenerate" button)
- On submit, call a new or existing edge function (reuse `regenerate-creative-cell` or `expand-creative`) with the feedback as context
- Update the production item's `script_lines`, `verbal_hook`, `written_hook`, and `visual_hook` with the regenerated output
- Wire this through `ProductionManager` up to `CreativeStudio` so the parent state and database are updated

**Files changed**:
- `src/components/creative/CreativeChecklistCard.tsx` — Add feedback UI + callback prop
- `src/components/creative/ProductionManager.tsx` — Add `onUpdateItem` handler, pass to card
- `src/pages/CreativeStudio.tsx` — Add `updateProductionItem` function that calls edge function and saves

## 3. Move Action Buttons to Top Right

**Problem**: Action buttons (Continue to Ad Copy, Continue to Build, Generate Creative, etc.) are at the bottom of the page and hard to find.

**Fix**: In `CreativeStudio.tsx`, move the primary action buttons from the bottom of each tab content to the top-right header area, next to the workspace selector:
- Create a "sticky action bar" below the tabs header that shows the contextual primary action for each tab
- Angles tab: "Generate Creative" button (when angles are selected)
- Concepts tab: "Continue to Ad Copy" button (when items added)
- Copy tab: "Continue to Build" button
- Build tab: "Build Campaign" button
- Keep existing bottom buttons as secondary fallback on mobile

**Files changed**:
- `src/pages/CreativeStudio.tsx` — Add action button row between tabs header and tab content

## 4. Full-Page Creative Studio Layout

**Problem**: The Creative Studio feels cramped inside the standard dashboard layout, making it hard to see the workflow progression.

**Fix**: Make the Creative Studio render as a full-page overlay/expanded view:
- Replace `DashboardLayout` wrapper with a custom full-page layout for CreativeStudio
- Add a sticky top bar with: back arrow to return to dashboard, brand name, workspace selector, and the primary action button
- Use the full viewport height and width (no sidebar nav, no dashboard header)
- Keep the 4-step workflow tabs prominent at the top
- Add a "Back to Dashboard" button in the top-left

**Files changed**:
- `src/pages/CreativeStudio.tsx` — Replace `DashboardLayout` with a custom full-screen layout, add back button + streamlined header

## 5. Make Angles/Concepts More Visible

**Problem**: Angle pills and concept cards blend into the background and are easy to miss, especially with multiple angles.

**Fix**: Improve visual prominence of angles, concepts, and workflow steps:
- **Angle pills**: Make them larger with a colored left border or gradient background when active, add the angle description as a subtitle below the pill row
- **Concept cards**: Increase card contrast with a subtle left-border color per angle, make hooks bold and larger (text-base instead of text-sm)
- **Selected state**: Add a stronger visual indicator (filled background, checkmark overlay) for selected angles and added-to-checklist concepts
- **Tab progress indicators**: Add completion dots/badges on the workflow tabs showing which steps have content (e.g., a green dot on "Angles" when angles exist)

**Files changed**:
- `src/pages/CreativeStudio.tsx` — Enhanced angle pill styling, tab badges, concept card styling
- `src/components/creative/AngleSelector.tsx` — Larger, more prominent angle cards

---

## Technical Details

### Edge Function Changes (Date Injection)
Each AI edge function gets a single line added to its prompt:

```
Today's date is [Month Day, Year]. Ensure all content is seasonally appropriate and relevant to this time period.
```

### Script Feedback Flow
```text
User clicks "Refine Script"
  -> Inline textarea appears
  -> User types feedback
  -> Calls regenerate-creative-cell edge function with:
     { cellId, feedback, existingScript, brandContext }
  -> Returns updated script_lines + hooks
  -> Updates production item in state + Supabase
```

### Full-Page Layout Structure
```text
+--------------------------------------------------+
| <- Back    [Brand Name]    [Workspace v]   [CTA]  |
+--------------------------------------------------+
| [Angles] [Concepts] [Ad Copy] [Build]            |
+--------------------------------------------------+
|                                                    |
|              Full-width tab content                |
|                                                    |
+--------------------------------------------------+
```

