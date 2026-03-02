

## Plan: Update Navigation & Home Screen Behavior

### Summary

Four changes requested:

1. **Replace "Next Steps" button** in the sidebar with two prominent buttons: **"Create a New Ad"** and **"See Live Ads"**
2. **Make the Start page (`/start`) the default landing** for returning users (login redirects to `/start` instead of requiring onboarding). Onboarding only for brand-new users with no brands.
3. **Lumi logo click → `/start`** (already works in sidebar, just confirm consistency)
4. **"Create a New Ad" button → choice screen**: "Create a New Ad Campaign" or "Create New Ads for an Existing Campaign"

---

### Changes

#### 1. Sidebar: Replace "Next Steps" with two buttons
**File:** `src/components/AppSidebar.tsx`

- Remove the single "Next Steps" gradient button (lines 92–104)
- Replace with two stacked buttons:
  - **"Create a New Ad"** — gradient style, navigates to `/create` (which will now show a choice modal/screen)
  - **"See Live Ads"** — outline/secondary style, navigates to `/data` (Results/performance dashboard)
- Keep both buttons responsive to sidebar collapsed state (show icon-only when collapsed)

#### 2. Login redirect logic — existing users go to `/start`
**File:** `src/pages/Auth.tsx` (line 84)

- Already redirects to `/start` on login. No change needed here.

**File:** `src/pages/Start.tsx` (lines 71–79)

- Currently, if `activeBrand` is null, it redirects to `/onboarding`. This is correct — only brand-new users (no brands) get sent to onboarding. Returning users with at least one brand land on `/start`. This already works as described.

#### 3. Lumi logo click → `/start`
**File:** `src/components/AppSidebar.tsx`

- Make the logo image clickable with `onClick={() => navigate("/start")}` and add `cursor-pointer`
- Mobile header logo already navigates to `/start` (confirmed in `MobileHeader.tsx` line 37)

#### 4. "Create a New Ad" → choice: New Campaign vs. Existing Campaign
**File:** `src/pages/Create.tsx`

- Add an initial "entry step" before the current flow that asks:
  - **"Create a New Ad Campaign"** → continues into the existing Create flow (offer selection → template → generation)
  - **"Create New Ads for an Existing Campaign"** → navigates to `/advanced-build` (the existing "Add to Campaign" flow)
- This step renders as two large selectable cards, matching the app's existing card-based UI pattern

---

### Technical Details

- The sidebar button replacement is purely UI — swap one button block for two
- The Create page entry step is a new `step: "entry"` added before the current step machine, defaulting to show on mount
- Logo clickability requires wrapping the `<img>` in a clickable element with navigation
- No database changes needed
- No new components needed — all changes fit within existing files

