

# One-Week Free Trial with Email Reminders

## Summary
Add a 7-day free trial with payment info collected upfront via Stripe. Users auto-convert to paid after 7 days unless they cancel. Includes trial-specific UI and a reminder email drip.

## Changes

### 1. Add `trial_period_days: 7` to both checkout functions
**Files:** `supabase/functions/create-checkout/index.ts`, `supabase/functions/create-guest-checkout/index.ts`

- `create-checkout`: Add `subscription_data: { trial_period_days: 7 }` to `sessionOptions`
- `create-guest-checkout`: Add `trial_period_days: 7` as default for ALL checkouts (not just partner trials). Partner trials keep 14 days as override. The `subscription_data` block moves outside the `if (isPartnerTrial)` check with 7-day default, overridden to 14 when partner code is valid.

No changes needed to `check-subscription` — it already detects `trialing` and returns `is_trial: true`.

### 2. Update Pricing + Sales page messaging
**Files:** `src/pages/Pricing.tsx`, `src/pages/Sales.tsx`

- Change CTA "Get Started" to "Start 7-Day Free Trial"
- Add subtext: "7-day free trial · Cancel anytime · No charge until day 8"
- Update the comparison card Lumi price area to mention the trial

### 3. Trial countdown banner on Dashboard
**File:** `src/pages/Dashboard.tsx`

When `useSubscription().isTrial` is true, render a banner at the top showing:
- Days remaining (derived from `subscriptionEnd`)
- Milestone progress: brand set up, offer added, Meta connected, first ad published (query from existing data)
- "Subscribe now" CTA linking to Stripe customer portal

### 4. Trial reminder email edge function
**New file:** `supabase/functions/send-trial-reminders/index.ts`

Cron-triggered daily function that:
1. Queries Stripe for all customers with `status: 'trialing'` subscriptions
2. Calculates days since trial start
3. Checks milestone completion per user (brand, offer, Meta connection, campaign) via Supabase
4. Sends targeted Resend emails on days 0, 3, 5, 7 with milestone-aware content
5. Logs via existing `log-email.ts`

Email schedule:
| Day | Subject | Content |
|-----|---------|---------|
| 0 | "Welcome to your free trial!" | First steps checklist |
| 3 | "3 days in — here's your next step" | Nudge incomplete milestones |
| 5 | "2 days left — let's get your ads live" | Push to connect Meta + publish |
| 7 | "Your trial ends today" | Subscribe or lose access |

### 5. Skip trial users in onboarding drip
**File:** `supabase/functions/send-onboarding-drip/index.ts`

Before processing each user, check if they have an active Stripe trial. If so, skip them (trial reminders handle their communication instead).

### 6. Schedule the cron job
SQL insert via Supabase to run `send-trial-reminders` daily at 9am UTC using `pg_cron` + `pg_net`.

## Files Summary
| File | Action |
|------|--------|
| `supabase/functions/create-checkout/index.ts` | Add trial_period_days |
| `supabase/functions/create-guest-checkout/index.ts` | Add trial_period_days default |
| `src/pages/Pricing.tsx` | Trial CTA + messaging |
| `src/pages/Sales.tsx` | Trial CTA + messaging |
| `src/pages/Dashboard.tsx` | Trial countdown banner |
| `supabase/functions/send-trial-reminders/index.ts` | New — trial email drip |
| `supabase/functions/send-onboarding-drip/index.ts` | Skip trialing users |

## Technical Notes
- No database schema changes needed
- Stripe handles billing lifecycle natively — trial → active on day 8, or trial → cancelled
- `SubscriptionContext` already exposes `isTrial` and `subscriptionEnd`
- Existing `handle-cancellation` flow covers trial expiration (user doesn't convert)

