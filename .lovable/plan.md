

## Fix: Ad Preview Copy Edits Not Saving

### Problem
When users edit copy in the Ad Preview modal (Build tab), changes are lost because:
1. The `onUpdateWorkspace` handler only calls `setWorkspace` — never updates the `angleCopy` state (the actual source of truth)
2. No database persistence occurs
3. `ProductionManager` prioritizes `angleCopyProp` over workspace data, making the workspace-only update invisible

### Fix (single file change)

**`src/pages/CreativeStudio.tsx`** — Replace the inline `onUpdateWorkspace` at line 1332 with a dedicated `handleUpdateWorkspace` callback that:

1. Checks if `updates.creative_json?.angle_copy` exists
2. If yes: updates `angleCopy` state via `setAngleCopy`, merges into `creativeJsonRef`, persists to Supabase (same pattern as `handleSaveCopy` on line 541), and syncs local `workspace` state
3. Always falls through to `setWorkspace` for non-copy fields

This is ~15 lines of new callback code, replacing a single inline arrow function. No database migration, no new components, no edge function changes needed.

