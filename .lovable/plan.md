

## Plan: Separate My Brand, Offers, and Meta Connection

### What Changes

1. **Split `/dashboard` into two pages**:
   - `/dashboard` (My Brand) — Brand Details, Content Assets/Brand Brain, Audience Psychology, **plus** the Brand Settings content (Copy Voice, Emoji Preferences, Meta Best Practices) merged in as sections. **Remove** the Meta Ad Account card and the Offers section.
   - `/offers` (new page) — Extract the `OfferManager` into its own dedicated page.

2. **Meta Connection sidebar link** — Keep pointing to `/meta-settings` (already exists as a full page). Remove Meta connection card from Dashboard brand-settings tab entirely.

3. **Sidebar nav updates** (`src/components/AppSidebar.tsx`):
   - "My Brand" → `/dashboard` (no query param)
   - "Offers" → `/offers`
   - "Meta Connection" → `/meta-settings` — add a dynamic green checkmark (`CheckCircle2`) or red alert (`AlertTriangle`) icon based on `brand.meta_account_id` status

4. **Remove tabs from Dashboard** — Since Brand Settings content merges into the single My Brand view and Offers/Meta are gone, the two-tab structure is no longer needed. The page becomes a single scrollable view.

### Files Changed

1. **`src/pages/Dashboard.tsx`** — Remove Tabs wrapper, remove Offers section, remove Meta connection card, inline Brand Settings content (Copy Voice, Emoji, Meta Best Practices) below the Brand Brain section
2. **`src/pages/Offers.tsx`** (new) — Simple page with `DashboardLayout` wrapping `OfferManager`, fetching brand + offers
3. **`src/components/AppSidebar.tsx`** — Update nav paths, add Meta connection status indicator (green check / red alert) using brand data from a lightweight query
4. **`src/App.tsx`** — Add route for `/offers`

### Technical Detail: Meta Status in Sidebar

The `AppSidebar` already receives `brandId`. We'll add a small effect to check `brands.meta_account_id` and `brands.meta_token_expires_at` for the active brand. If `meta_account_id` exists and token isn't expired → green `CheckCircle2`. If missing or expired → red `AlertTriangle`. This renders next to the "Meta Connection" label.

