

## Bug Report Review & Fix Plan

### Summary of Findings

After investigating each bug, here is the status and proposed fix for each:

---

### Bug 1: Video upload hitting 20MB size cap
**Status:** Still present  
**Root Cause:** Three upload components enforce a hard 20MB limit: `DragDropUploader.tsx` (line 26), `CreativeUploader.tsx` (line 71), and `ProductionManager.tsx` (line 387). The UI text in some places says "Max 50MB" but the validation rejects at 20MB.

**Fix:**
- Raise the file size limit to 50MB in all three components
- Update validation messages to match
- Note: Supabase Storage supports up to 50MB by default, so no backend change needed

---

### Bug 2: Custom copy reverting to website-generated copy (HIGH PRIORITY)
**Status:** Partially fixed by previous angle_copy reconciliation work, but root cause remains  
**Root Cause:** `saveCreativeState` in `CreativeStudio.tsx` (line 501) reads from `workspace.creative_json` which is a **stale closure** — it captures the workspace state from initial load. When multiple saves happen in sequence (e.g., auto-save of `selectedAngleIds` at line 491 races with `handleSaveCopy` at line 530), the second save overwrites the first because both read from the same stale `workspace` object. The `workspace` state is never refreshed after saves.

**Fix:**
- Change `saveCreativeState` to use a ref that always holds the latest `creative_json` state, updated after each successful save
- Same fix for `handleSaveCopy` — it should merge into the ref, not the stale `workspace` prop
- Add an optimistic local update to `workspace` state after each save so subsequent saves see fresh data

---

### Bug 3: Creative Studio edits not saving/persisting
**Status:** Same root cause as Bug 2  
**Root Cause:** Same stale closure issue. When a user edits production items or grid data and then switches tabs (triggering a `selectedAngleIds` auto-save), the auto-save overwrites the entire `creative_json` with stale data, reverting the user's edits.

**Fix:** Same as Bug 2 — the ref-based approach will fix both issues together.

---

### Bug 4: Importing Meta campaigns — "Failed to send a request to edge function"
**Status:** Still present  
**Root Cause:** `sync-meta-campaigns/index.ts` has its own **inline CORS config** (lines 4-21) that:
1. Is **missing `adsbylumi.com`** from allowed origins (only has `youradassistant.app`)
2. Is **missing required Supabase client headers** (`x-supabase-client-platform`, `x-supabase-client-platform-version`, etc.)

When users access via `adsbylumi.com`, the CORS preflight fails because the origin isn't allowed and the headers aren't permitted, causing the browser to block the request entirely.

**Fix:**
- Replace the inline CORS config with the shared `getCorsHeaders` from `_shared/cors.ts` (which already includes `adsbylumi.com` and all required headers)
- Update the import from `esm.sh` to `npm:` for consistency

---

### Bug 5 & 6: Campaign launch/publish — "Failed to send a request to Edge Function"
**Status:** Needs investigation — likely same CORS root cause for some users  
**Root Cause:** `build-meta-campaign` already uses the shared CORS module, so it should work from `adsbylumi.com`. However, the `customer-portal/index.ts` also has the same inline CORS problem. The "Failed to send a request" error for campaign publish could be caused by:
1. The same CORS issue if any intermediate function call (like `sync-meta-campaigns`) is involved in the publish flow
2. Edge function timeout or auth issues — the logs show "invalid claim: missing sub claim" errors for sync-meta-campaigns

**Fix:**
- Fix all edge functions with inline CORS configs to use the shared module (`sync-meta-campaigns`, `customer-portal`)
- Add better error messages in `CampaignBuilder.tsx` to distinguish CORS failures from auth failures from function errors
- Add `formatInvokeError` usage (already exists in codebase) to surface the actual error instead of the generic message

---

### Implementation Order

1. **Fix CORS on sync-meta-campaigns and customer-portal** — highest impact, affects multiple reported bugs (4, 5, 6)
2. **Fix stale closure race condition in CreativeStudio** — fixes bugs 2 and 3 (data loss)
3. **Raise upload size limit to 50MB** — quick fix for bug 1
4. **Improve error messaging** for edge function failures

### Files to Edit
- `supabase/functions/sync-meta-campaigns/index.ts` — replace inline CORS with shared module
- `supabase/functions/customer-portal/index.ts` — replace inline CORS with shared module
- `src/pages/CreativeStudio.tsx` — fix stale closure in `saveCreativeState` and `handleSaveCopy`
- `src/components/DragDropUploader.tsx` — raise 20MB → 50MB
- `src/components/CreativeUploader.tsx` — raise 20MB → 50MB
- `src/components/creative/ProductionManager.tsx` — raise 20MB → 50MB
- `src/pages/CampaignBuilder.tsx` — improve error messages with `formatInvokeError`

