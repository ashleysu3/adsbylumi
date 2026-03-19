

## Four Changes to Creative Studio

### 1. Audience Psychology: Auto-open and gate ad creation

**Problem**: The `AudiencePsychology` component in `Dashboard.tsx` starts collapsed (`open` defaults to `false`). Users can skip approving it and jump straight into creative.

**Changes**:
- **`src/components/AudiencePsychology.tsx`**: Default `open` to `true` when psychology exists but is not yet approved (status === `'completed'`).
- **`src/pages/CreativeStudio.tsx`**: Before allowing angle generation, check if `workspace.brands.psychology_status !== 'approved'`. If not approved, show an alert/toast telling them to approve their audience psychology on the Dashboard first, and block generation.

### 2. Fix the Generate Angles button

**Problem**: The first-time "Generate Angles" button (line 1133) calls `generateAngles()` directly without opening the context input dialog (which asks the perspective question). Only the *Regenerate* flow opens the context dialog.

**Change in `src/pages/CreativeStudio.tsx`**:
- Change the first-time "Generate Angles" button's `onClick` from `() => generateAngles()` to `() => setShowContextInput(true)` so users always get the context/perspective question before generation.

### 3. Auto-save indicator works across all tabs

**Problem**: The floating auto-save pill (bottom-right) only shows `saveStatus` from `saveCreativeState`. The copy tab uses its own `copySaveStatus`, and production saves go through `saveProductionItems` — neither updates the floating indicator.

**Change in `src/pages/CreativeStudio.tsx`**:
- Unify the floating indicator to show the *most recent* save status across all three: `saveStatus`, `copySaveStatus`, and a new production save status. Derive a combined status: if any is `"saving"`, show saving; if any is `"error"`, show error; else show the most recently changed saved/idle state.
- Update `saveProductionItems` to also set `setSaveStatus` so it flows through the same indicator.
- Update the floating pill to show `copySaveStatus` when on the copy tab, and `saveStatus` otherwise.

### 4. After Lumi's Top 5, prompt to save others

**Problem**: After ranking, the "Save Others for Later" button exists but users must find it themselves. The user wants an automatic prompt.

**Change in `src/components/creative/ProductionManager.tsx`**:
- After `handleRankConcepts` succeeds and `rankedItems` are set, show a confirmation dialog/toast asking: "Want to save the other concepts to your library for later?" with Yes/No actions.
- On "Yes", call `handleMoveOthersToLibrary()`.
- On "No", dismiss.

### Files Changed

| File | Change |
|------|--------|
| `src/components/AudiencePsychology.tsx` | Auto-open when status is `completed` |
| `src/pages/CreativeStudio.tsx` | Gate angle generation on psychology approval; fix Generate Angles button to open context dialog; unify auto-save indicator |
| `src/components/creative/ProductionManager.tsx` | Auto-prompt to save non-Top-5 concepts after ranking |

