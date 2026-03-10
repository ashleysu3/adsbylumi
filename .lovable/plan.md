

## Plan: Replace Empty State with "Bench Creative" + Add Concept-to-Bench Flow

### What Changes

**1. Update empty state in `CreativeBenchPanel.tsx` (lines 137-148)**

Replace "No Creative Tracked Yet" with a "Bench Creative" section that:
- Shows heading "Bench Creative" with a brief explanation: "Add concepts here so Lumi can swap them in when creative fatigue is detected."
- Adds a "Add from Concept Library" button that opens a dialog to pick saved concepts

**2. Add "Move to Bench" dialog in `CreativeBenchPanel.tsx`**

New inline dialog/sheet that:
- Fetches the workspace's `creative_json` → `creative_mix` concepts and `loved_concepts`
- Shows saved/loved concepts as selectable cards (name, format, stage badge)
- On confirm, inserts selected concepts into `creative_bench` table with `status: 'bench'`, storing concept data in `production_item_id` (concept ID) and `performance_snapshot` (concept details like hook, script, angle name for Lumi to use during rotation)

**3. Update `SavedConcepts.tsx`**

Add a "Move to Bench" button on each concept card (alongside the existing heart/remove button). Clicking it inserts directly into `creative_bench` for that workspace.

**4. Enhance bench item display**

When bench items come from concepts (no `meta_ad_id`), show the concept name/hook instead of just the production_item_id. Parse concept details from `performance_snapshot` to display meaningful info.

### Database

No schema changes needed — `creative_bench` already has `production_item_id` (for concept reference) and `performance_snapshot` (JSON, can store concept details). The `meta_ad_id` is nullable, so concept-only bench items work.

### Files to Edit

- `src/components/insights/CreativeBenchPanel.tsx` — new empty state, add-from-library dialog, better display names
- `src/components/SavedConcepts.tsx` — add "Move to Bench" button per concept card

