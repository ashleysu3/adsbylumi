

# Two Changes: Campaign Limit + Meta Settings Page Cleanup

## 1. Limit live campaigns to 10

**Where to enforce**: `src/pages/CampaignBuilder.tsx` in `handlePublish`

Before calling `build-meta-campaign`, query `campaign_workspaces` for the current brand where `meta_campaign_status` is `'active'` or `'live'` and count them. If count >= 10, block publish with a toast error: "You've reached the maximum of 10 live campaigns. Please pause or archive an existing campaign before publishing a new one." and return early (don't proceed to build).

Also add a visible warning in the QA check stage or configure stage if the user is at 9 or 10 live campaigns.

**Files**: `src/pages/CampaignBuilder.tsx`

---

## 2. Clean up Meta Settings page — remove duplication, rename readiness checklist, add "working on it" note

The current MetaSettings page (`src/pages/MetaSettings.tsx`) shows three separate cards that overlap in content:
- **Connection Status Card** (lines 322-760) — shows ad account, page, Instagram, token status
- **MetaReadinessChecklist** (lines 762-772) — shows the same 4 items (page, Instagram, ad account, pixel) with red X marks
- **PixelVerificationCard** (lines 826-835) — dedicated pixel card

The readiness checklist duplicates what the connection card already shows and the red X icons alarm users unnecessarily.

### Changes to `MetaReadinessChecklist.tsx`:
- Rename title from "Getting Your Ads Ready" to "Connection Status"
- Replace red `XCircle` icons with amber/neutral `Clock` or `Minus` icons for incomplete items — less alarming
- Add an info banner at the top: "We're actively working with Meta to finalize full verification. Your connection is working — this checklist will update automatically within 24-48 hours."
- For incomplete items, change the background from `bg-destructive/5` to `bg-amber-500/5` (softer)

### Changes to `MetaSettings.tsx`:
- Only show `MetaReadinessChecklist` when the user is NOT fully connected (when `!isConnected`). When connected, the connection card already shows everything.
- Remove the `PixelVerificationCard` from showing separately when `MetaReadinessChecklist` is visible (it already has a pixel row). Keep it only when connected.

**Files**: `src/components/MetaReadinessChecklist.tsx`, `src/pages/MetaSettings.tsx`

