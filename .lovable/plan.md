

## Plan: Stay on Results Tab After Linking an Offer

### Problem
Two places redirect away from the Results tab after linking an offer:
1. `InsightsHome.tsx` line 198: `handleOfferLinked` navigates to `/creative?workspace=...&addCreative=true`
2. `CampaignInsightDetail.tsx` line 235-238: calls `onOfferLinked?.()` which correctly stays (just refetches campaigns in `Data.tsx`)

### Changes

**`src/components/insights/InsightsHome.tsx`** (line 197-199)
- Change `handleOfferLinked` to simply close the modal, refresh the campaigns list, and stay on the current page
- Replace `navigate(...)` with: close the `linkOfferModal`, call `fetchCampaigns()` to refresh the list, and show a toast confirming the link

That's it — one function change in one file.

