## Win-Back Trial: Consent-Based Reactivation Flow

Today, clicking "Grant 14-Day Trial + Email" in the admin panel immediately creates a Stripe subscription. That's both the source of the `non-2xx` error you saw and the wrong UX — the user has no say in when their trial clock starts or when billing resumes.

This plan reworks it into a true *offer* the user accepts on their own terms.

---

### New end-to-end flow

1. **Admin** opens the user's Actions tab → clicks **"Send 14-Day Trial Offer"** (renamed). Optionally edits the post-trial monthly price shown in the offer.
2. **Backend** creates a `winback_offers` row (token, user, price, expiry — e.g. 30 days to accept) and emails the user a branded "Welcome back" message with a single CTA button: *"Reactivate my account"*.
3. **User clicks the link** → lands on a new public page `/reactivate/:token` showing:
   - "Your 14-day free trial starts the moment you confirm."
   - "After the trial ends on **{trialEnd}**, your card on file (•••• {last4}) will be charged **${price}/mo**."
   - "Cancel anytime before then and you won't be charged."
   - Required checkbox: *"I understand and agree to reactivate my subscription."*
   - **Confirm & Reactivate** button (disabled until checked).
4. **On confirm** → backend records consent (IP, timestamp, user agent), creates the Stripe subscription *now* with `trial_period_days: 14` using the saved payment method, marks the offer `accepted`, and redirects user to…
5. **New onboarding choice page** `/welcome-back`:
   - **"Pick up where I left off"** → restores their previous brand/campaigns and routes to the dashboard.
   - **"Start fresh"** → archives prior brand data and routes to the standard new-user onboarding wizard.

The offer link is single-use, expires after 30 days, and shows a clean "this offer has expired / already used" state if reused.

---

### Fix for the current `non-2xx` error

The current edge function fails for one of these reasons (all addressed by the new flow):

- The customer has **no saved payment method** → `default_incomplete` creates a sub that can never auto-charge. The new flow checks for a usable payment method *before* creating the offer, and if none exists, the reactivation page collects one via Stripe Checkout in setup mode before creating the subscription.
- The previous `price_id` was **archived/deleted** in Stripe → we'll fall back to the current standard price (or the admin-overridden custom price) and surface a clear error if neither is resolvable.
- The user already had a `canceled` sub whose price product is gone → same fallback.
- Resend send failure was swallowed, but the Stripe error wasn't — we'll add explicit try/catch with readable error messages returned to the admin UI.

I'll also log the exact failure reason to the function logs so future issues are diagnosable from the admin Audit Log.

---

### What gets built

**Database (new migration)**
- `winback_offers` table: `id`, `user_id`, `email`, `token` (unique), `offered_price_cents`, `trial_days`, `status` (`pending`/`accepted`/`expired`/`revoked`), `expires_at`, `accepted_at`, `consent_ip`, `consent_user_agent`, `stripe_subscription_id`, `created_by_admin_id`, timestamps. RLS: admins manage, public can read by token only.

**Edge functions**
- `admin-user-management`: replace `grant_winback_trial` action with `create_winback_offer` (no Stripe sub created — just the offer row + email).
- New `winback-offer` function with two actions:
  - `get` (public, by token) → returns offer details + card last4 + computed dates.
  - `accept` (public, by token) → validates, creates Stripe subscription with 14-day trial, records consent, returns redirect URL.

**Frontend**
- `src/pages/admin/Users.tsx`: rename button to "Send 14-Day Trial Offer", add optional price override input, show toast with offer link for manual share.
- New page `src/pages/Reactivate.tsx` (public route `/reactivate/:token`): offer summary, consent checkbox, confirm button, expired/used states.
- New page `src/pages/WelcomeBack.tsx` (auth-required `/welcome-back`): two-card choice screen, wires to existing brand/onboarding flow.
- Route registrations in `App.tsx`.

**Email**
- New branded "Reactivation offer" template sent via existing Resend setup, with the unique link and clear pricing disclosure.

### Why this is safer

- No subscription exists until the user explicitly clicks **and** checks the consent box → no surprise charges, no double-billing risk.
- Stored consent record (IP + timestamp + user agent) gives you a paper trail if a user later disputes.
- Pre-flight validation (payment method present, price resolvable) eliminates the current error class entirely.