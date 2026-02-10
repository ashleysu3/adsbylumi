
# Fix Angle Grid, Card Borders, Angle Persistence, and Library Naming

## 1. Fix Angle Count for Perfect 3x4 Grid

Currently the edge function generates 10-12 angles, plus 1 default = 11-13 total. For a perfect 3x4 grid (12 cards), we need exactly 11 AI-generated angles + 1 default = 12 total.

**File**: `supabase/functions/generate-creative-angles/index.ts`
- Change the prompt from "Generate 10-12 creative angles" to "Generate exactly 11 creative angles"
- This ensures 11 AI angles + 1 "Straight from Your Page" default = 12 = perfect 3x4 grid

## 2. Fix Card Borders (Full Border on Hover Instead of Left-Only)

The angle selector cards currently use `border-l-4` which creates a left-only colored border that looks like a "half shadow." This will be replaced with a full border that highlights all sides on hover/selection.

**File**: `src/components/creative/AngleSelector.tsx`
- Remove all `border-l-4` and `border-l-*` classes from the Card
- Replace with full `border-2` styling:
  - Default angle: `border-2 border-primary/30 border-dashed` (dashed all around)
  - Selected: `border-2 border-primary ring-2 ring-primary/20` (solid primary border all around)
  - Unselected hover: `border-2 border-transparent hover:border-primary/40` (full border appears on hover)
  - Disabled: `border-2 border-muted opacity-50`

## 3. Fix Angle Selection Not Persisting ("Angles Aren't Sticking")

The angle selection state is saved to `creative_json.selectedAngleIds` but may not persist correctly on reload. The issue is in `loadWorkspace` where the default angle injection and validation logic runs -- if the workspace reloads and angles get re-validated, selections can be lost.

**File**: `src/pages/CreativeStudio.tsx`
- Ensure `saveCreativeState` is called whenever `selectedAngleIds` changes (not just on generation)
- Add a `useEffect` that saves `selectedAngleIds` to the workspace whenever the user toggles an angle, with a short debounce to avoid excessive writes

## 4. Fix Content Library vs Concept Library Naming Confusion

The **Content Library** is the Brand Brain tab where users paste raw content (testimonials, scripts, etc.). The **Concept Library** (`/content-library` page) is where saved creative concepts go. Currently the page at `/content-library` is titled "Content Library" which creates confusion.

### Rename the Concept Library page
**File**: `src/pages/ContentLibrary.tsx`
- Change page title from "Content Library" to "Saved for Later"
- Update subtitle to "Creative concepts you've saved to revisit or use in future campaigns"

### Rename navigation items
**File**: `src/components/DashboardLayout.tsx`
- Change dropdown menu item from "Concept Library" to "Saved for Later"

**File**: `src/components/MobileHeader.tsx`
- Change dropdown menu item from "Concept Library" to "Saved for Later"

### Rename save buttons
**File**: `src/components/creative/CreativeChecklistCard.tsx`
- Change "Save to Concept Library" to "Save for Later"

**File**: `src/components/creative/ProductionManager.tsx`
- Change "Move Others to Concept Library" to "Save Others for Later"
- Change toast message from "Moved X concepts to Concept Library" to "Saved X concepts for later"

**File**: `src/pages/CreativeStudio.tsx`
- Change toast message from "Saved to Concept Library" to "Saved for later"

## Summary of Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-creative-angles/index.ts` | Generate exactly 11 angles (for 12 total with default) |
| `src/components/creative/AngleSelector.tsx` | Replace `border-l-4` with full `border-2` on all sides |
| `src/pages/CreativeStudio.tsx` | Add debounced save for selectedAngleIds; rename toast |
| `src/pages/ContentLibrary.tsx` | Rename to "Saved for Later" |
| `src/components/DashboardLayout.tsx` | Rename nav item to "Saved for Later" |
| `src/components/MobileHeader.tsx` | Rename nav item to "Saved for Later" |
| `src/components/creative/CreativeChecklistCard.tsx` | Rename button to "Save for Later" |
| `src/components/creative/ProductionManager.tsx` | Rename button and toast |
