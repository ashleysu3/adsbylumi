

## Plan: Creative Studio UX Refinements

### Summary
Four related changes to the Creative Studio's action buttons, feedback flow, and auto-save behavior.

---

### 1. Replace centered "Regenerate" with top-right "Give Feedback" button (under tabs)

**File: `src/pages/CreativeStudio.tsx`**

- Add a row below the `TabsList` (inside the `Tabs` component, before `TabsContent`) that shows a small "Give Feedback" button aligned to the right.
- This button appears on tabs where regeneration is available: **angles** (when angles exist), **concepts** (when grid exists), **copy** (when copy exists).
- Icon: `MessageSquare` (or `RefreshCw`). Smaller font (`text-xs`), ghost/outline variant.
- Clicking it opens the existing `CopyRegenerateDialog` (repurposed) or a new lightweight feedback dialog that collects quick-select feedback + freeform notes, then triggers regeneration for the current tab's content.
- Remove the centered "Regenerate" button row from the angles tab (lines ~1346-1353).

### 2. Replace "See What's Worked" with subtle "Insights Available" badge

**File: `src/pages/CreativeStudio.tsx`**

- When `workspace?.brands?.meta_account_id` exists (insights data is available), show a subtle highlighted badge/button below the "Choose your creative angles" heading text with the label "Insights Available" and a `BarChart3` icon.
- This replaces the current "See What's Worked" button in both locations (empty state ~lines 1323-1333 and the centered row ~lines 1347-1351).
- Clicking opens the existing `CreativeRefreshDialog` as before.
- Style: small, subtle highlight (e.g., `bg-primary/5 text-primary border-primary/20` pill).

### 3. Remove "Save Copy" button, keep auto-save indicator

**File: `src/components/creative/AngleCopyEditor.tsx`**

- Remove the "Save Copy" button block (lines ~587-596) and the "Auto-saves as you type" text below it.
- The auto-save mechanism already works via the debounced `useEffect` in `CreativeStudio.tsx` (lines 561-584) and the inline timer in `AngleCopyEditor` (line 242). These remain unchanged.
- The `AutoSaveIndicator` already shows at the top of the copy section (line 1498 in CreativeStudio) and the fixed bottom-right indicator (line 1777). These stay.
- Keep the `onSave` prop wired up for the inline auto-save timer to flush saves.

### 4. "Give Feedback" replaces individual "Regenerate" buttons

**File: `src/components/creative/AngleCopyEditor.tsx`**

- Rename the existing "Regenerate" / "Regenerate All" buttons (lines ~340-361) to "Give Feedback" / "Give Feedback (All)".
- They continue to open the `CopyRegenerateDialog` which already collects quick-select feedback before regenerating.

**File: `src/pages/CreativeStudio.tsx`**

- The top-right "Give Feedback" button per-tab triggers the appropriate feedback flow:
  - **Angles tab**: Opens the regenerate confirm dialog → context input (existing flow).
  - **Concepts tab**: Could open a similar feedback dialog for concept regeneration.
  - **Copy tab**: Opens the `CopyRegenerateDialog` (existing).

### Technical Details

- Reuse `CopyRegenerateDialog` as a general-purpose feedback dialog by making its title/description configurable via props.
- Add a `feedbackContext` state to track which tab triggered feedback.
- The auto-save in `CreativeStudio.tsx` (useEffect on `angleCopy` changes) is already robust — debounces at 1.5s and persists to `creative_json.angle_copy`. No changes needed to the save mechanism itself.
- No new database changes required.

### Files Modified
- `src/pages/CreativeStudio.tsx` — Layout changes, button reorganization, feedback button per tab
- `src/components/creative/AngleCopyEditor.tsx` — Remove Save button, rename Regenerate to Give Feedback
- `src/components/creative/CopyRegenerateDialog.tsx` — Minor: make title/description configurable via props

