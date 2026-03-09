

## Plan: Remove ad spend limit references and simplify signup flow

### What changes

**1. Remove "$3,000 ad spend" references**

- **`src/lib/subscription-tiers.ts`**: Remove "Up to $3,000/mo in managed ad spend" from `solo.features` array. Remove/update `adSpendCap` limit (set to -1 or remove).
- **`src/pages/Sales.tsx`**: Remove the "$3,000/mo agency retainers" pill from the "done with" section (line ~185). No other ad-spend-cap-specific references on this page need changing.
- **`src/pages/Pricing.tsx`**: Remove the entire "Ad Spend Cap" callout box (lines 196-207) that says "Up to $3,000/mo in ad spend". The features list auto-renders from `SUBSCRIPTION_TIERS.solo.features`, so removing it there handles that too.

**2. Eliminate the separate Pricing page — redirect to Auth**

The Sales page already has a full pricing section. Instead of maintaining a separate `/pricing` page, redirect `/pricing` to `/auth` so users go straight to signup.

- **`src/App.tsx`**: Change the `/pricing` route from `<Pricing />` to `<Navigate to="/auth" replace />`. Remove the Pricing import.
- **`src/components/SubscriptionGate.tsx`**: Change `navigate("/pricing")` calls to `navigate("/auth")` (banner + locked feature).
- **`src/components/AppSidebar.tsx`**: Change the locked "Create" button from `/pricing` to `/auth`.
- **`src/pages/Settings.tsx`**: Change "View All Plans" / "View Plans" buttons from `/pricing` to `/auth`.
- **`supabase/functions/create-checkout/index.ts`**: Update `cancel_url` from `/pricing?checkout=canceled` to `/auth`.

The `Pricing.tsx` file can be kept (it's still imported by the redirect) or removed — redirecting is sufficient.

### Summary

Two changes: (1) strip all "$3,000 ad spend cap" messaging from tiers config, Sales page, and Pricing page; (2) redirect `/pricing` → `/auth` everywhere so users go straight to signup instead of a separate pricing page.

