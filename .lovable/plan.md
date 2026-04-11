

# Fix Impersonation: Subscription, Trial Banner, and Meta Connection

## Problems Found

1. **Wrong trial/subscription banner**: `SubscriptionContext` always checks the logged-in admin's subscription (via JWT), not the impersonated user's. So when viewing as Erinn, you see YOUR subscription status — likely showing a trial banner that doesn't apply to her.

2. **Meta connection shows "not connected"**: `MetaSettings.tsx` line 158 queries brands with `.eq('user_id', user.id)` — using the admin's real auth ID, not Erinn's. The brand belongs to Erinn, so the query returns nothing, making it look disconnected.

3. **Dashboard shows green Meta badge but settings says disconnected**: The Dashboard uses `BrandContext` (which DOES respect impersonation via `getEffectiveUserId`), so the brand loads correctly there. But MetaSettings does its own query filtered by `auth.uid()`, which is the admin — mismatch.

## Changes

### 1. SubscriptionContext — respect impersonation
**File:** `src/contexts/SubscriptionContext.tsx`
- Import and use `useImpersonation` to get `getEffectiveUserId` and `isImpersonating`
- When impersonating, query the `subscriptions` table directly for the impersonated user's ID instead of calling `check-subscription` (which only checks the JWT holder)
- This ensures the trial banner, subscription status, and gate all reflect the impersonated user's actual state

### 2. MetaSettings — use effective user ID for brand query
**File:** `src/pages/MetaSettings.tsx`
- Import `useImpersonation` and call `getEffectiveUserId()`
- Change line 158 from `.eq('user_id', user.id)` to `.eq('user_id', effectiveUserId)`
- This ensures the Meta connection status loads correctly when impersonating

### 3. Dashboard subscription query — use effective user ID
**File:** `src/pages/Dashboard.tsx`
- Line 263-267 queries `subscriptions` table with `effectiveUserId` — verify this is already correct (it appears to be)
- The trial banner at line 489 uses `isTrial` from SubscriptionContext — once #1 is fixed, this will be correct

## Technical Detail
- `SubscriptionContext` currently sits outside the `ImpersonationProvider` or doesn't use it. We need to wire it in so it re-checks when impersonation starts/stops.
- The `check-subscription` edge function validates against the JWT, so we can't use it for impersonated users. Instead, we query the `subscriptions` table directly client-side with the effective user ID when impersonating.
- MetaSettings needs a one-line fix to swap `user.id` for the effective user ID.

## Files

| File | Change |
|------|--------|
| `src/contexts/SubscriptionContext.tsx` | Use impersonation context; query impersonated user's subscription directly |
| `src/pages/MetaSettings.tsx` | Use `getEffectiveUserId()` instead of `user.id` for brand query |

