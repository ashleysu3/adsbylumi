

## Fix: Prevent Brand Bouncing on MetaSettings for Agency Accounts

### Problem
When an agency user adds a new brand and navigates to `/meta-settings` to connect Meta, the page can load a **different brand** because:

1. **`fetchBrand` only runs once on mount** (`useEffect([], [])`) — it captures whatever `activeBrandId` exists at that moment, which may be stale or not yet updated to the new brand.
2. **Fallback query uses `updated_at` ordering** — if `activeBrandId` is missing or doesn't match, it falls back to `fetchLatestForUser()` which grabs the most recently *updated* brand, not the one the user just created.
3. **MetaSettings doesn't use `useBrand()` from BrandContext** — it relies on `useLumi()` which is a separate context. If BrandContext has the correct active brand but LumiContext hasn't synced yet, the page loads the wrong brand.
4. **No re-fetch when active brand changes** — if the user switches brands via the BrandSelector while on MetaSettings, the page doesn't update.

### Fix

**1. Use `useBrand()` as the source of truth in MetaSettings**
- Import and use `useBrand()` from BrandContext instead of (or in addition to) `useLumi()` for the active brand ID
- This ensures the brand ID is always the one the user explicitly selected

**2. Re-fetch when activeBrand changes**
- Add `activeBrand.id` to the `fetchBrand` useEffect dependency array so the page re-fetches when the user switches brands

**3. Remove the fallback to "latest updated" brand**
- If no `activeBrandId` is available, don't silently load a random brand — show a "select a brand" prompt or redirect to dashboard
- This prevents the "bounce" entirely

**4. Keep LumiContext in sync**
- After resolving the brand, still call `setBrandId()` on LumiContext so the AI assistant stays scoped

### Files to edit
- `src/pages/MetaSettings.tsx` — switch to `useBrand()`, add dependency on active brand, remove silent fallback

### Technical detail
```text
Current flow:
  Mount → read LumiContext.brandId (may be stale) → fetch brand → fallback to any brand

Fixed flow:
  Mount → read BrandContext.activeBrand.id (always current) → fetch that brand only
  Brand switch → re-fetch → update page
```

