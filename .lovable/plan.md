
Goal
- Make the Angles screen consistently render as a full 4x3 grid on desktop: 10 AI angles + 1 “Straight from Your Page” + 1 “Add Your Own” card.

What’s causing the bug
- The UI grid is already correct (`lg:grid-cols-4`), and “Add Your Own” is appended last.
- The real issue is data count: AI sometimes returns 11 angles, so total cards become 13 (11 AI + default + Add Your Own), which pushes “Add Your Own” to a new bottom row by itself.
- Existing workspaces may already have 11 saved AI angles in `creative_json`, so the issue persists even without regenerating.

Implementation plan
1) Enforce hard angle count in backend generation
- File: `supabase/functions/generate-creative-angles/index.ts`
- After parsing AI output, sanitize + dedupe + hard-cap:
  - `maxAngles === 1` → return 1 angle
  - default flow → return max 10 AI angles
- Keep single-angle replacement behavior unchanged.

2) Normalize legacy workspace angle data on load
- File: `src/pages/CreativeStudio.tsx`
- In `loadWorkspace`, normalize loaded angles before setting state:
  - preserve `direct_from_page`
  - keep max 10 generated (non-default) angles
  - remove overflow generated angles from state
- If overflow angles are removed, also reconcile and persist:
  - `selectedAngleIds`
  - `gridData`
  - `angle_copy` keys
- Save cleaned `creative_json` so the fix sticks for existing affected users.

3) Normalize fresh angle generation before save/render
- File: `src/pages/CreativeStudio.tsx` (`generateAngles`)
- Apply the same cap/normalization immediately after function response and before `setAvailableAngles` + `saveCreativeState`, preventing reintroduction of 13-card layouts.

Technical details
- Add a single shared helper in Creative Studio for deterministic normalization (stable order, ID/name dedupe, max generated count).
- Use a constant like `MAX_GENERATED_ANGLES = 10` in UI and mirror the same rule in the backend function output handling.
- No new UI steps or approval buttons added.

Validation checklist
- Open an existing affected workspace: confirm 12 cards total and “Add Your Own” sits in the bottom-right slot of the 4x3 grid.
- Regenerate angles: confirm only 10 AI angles are returned/displayed.
- Confirm copy/concepts still load without orphaned references after cleanup.
