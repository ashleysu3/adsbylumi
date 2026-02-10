

# Fix Creative Studio — 3 Issues

## 1. Restore Concept Cards to Previous Clean Style

The concept cards in the "Concepts" tab got restyled with `border-l-4` and heavy color treatments that look off. The fix is to revert them to a cleaner card style while keeping the improvements (bold hooks, "Why This Works", added-to-checklist state).

**Changes in `src/pages/CreativeStudio.tsx` (lines ~876-897)**:
- Remove `border-l-4` from concept cards
- Use a subtle `ring-2 ring-green-500/20 bg-green-50/30` for added items instead of a thick green left border
- Use standard card hover (`hover:shadow-md`) for non-added items
- Keep the bold hook text and "Why This Works" notes

## 2. Fix "No Angles Selected" Message on Ad Copy Tab

The Ad Copy tab renders `AngleCopyEditor`, which checks `selectedAngles.length === 0` at line 220 of `AngleCopyEditor.tsx`. The `selectedAngles` are derived from `angles.filter(a => selectedAngleIds.includes(a.id))`.

The issue: when the user has production items (concepts added to checklist) but the `selectedAngleIds` array doesn't match the angles passed in, the copy editor shows "No Angles Selected."

**Root cause**: The `selectedAngleIds` state might not persist correctly, or when concepts were added from only one angle but the user didn't "select" angles in the traditional checkbox sense.

**Fix in `src/pages/CreativeStudio.tsx`**: When rendering the copy tab, derive `selectedAngleIds` from the production items' `angleId` fields as a fallback. If `selectedAngleIds` is empty but production items exist, extract the unique angle IDs from those items and use those instead. This ensures the copy tab always has angles to work with when concepts have been selected.

## 3. Replace Progress Dots with Checkmarks

Currently the tab progress indicators are gradient-colored dots. Replace them with small checkmark icons to clearly indicate completion.

**Changes in `src/pages/CreativeStudio.tsx` (lines ~805-807)**:
- Replace the `<span>` dot with a `CheckCircle2` icon (already imported) or a small `Check` icon inside a circle
- Use the brand gradient as background with a white checkmark for clear visibility
- Keep the `absolute -top-1 -right-1` positioning

---

## Technical Details

### Concept Card Fix (before/after)
- **Before (current broken)**: `border-l-4 border-l-green-500 ring-2 ring-green-500/30` -- heavy, cluttered
- **After (fix)**: Clean card with subtle `ring-1 ring-green-200 bg-green-50/50` for added state, standard `hover:shadow-md border` for unselected

### Ad Copy Angle Fallback Logic
```typescript
// Derive effective angle IDs for copy tab
const effectiveAngleIds = selectedAngleIds.length > 0
  ? selectedAngleIds
  : [...new Set(productionItems.map(p => p.angleId).filter(Boolean))];
```
Pass `effectiveAngleIds` to `AngleCopyEditor` instead of `selectedAngleIds`.

### Checkmark Indicator
Replace the dot span with:
```tsx
<span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
  <Check className="h-2.5 w-2.5 text-white" />
</span>
```
This requires importing `Check` from lucide-react (or reusing `CheckCircle2`).
