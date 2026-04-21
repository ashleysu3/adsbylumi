

## Build a "Welcome to Lumi" confirmation page for Meta ad tracking

Create a dedicated celebration page at a fixed, trackable URL that users land on **once** immediately after their first successful Lumi signup. This gives you a clean conversion event you can fire a Meta pixel custom conversion against.

### The trackable URL

`/welcome` — clean, semantic, easy to set up as a Meta custom conversion (URL contains "welcome").

### User flow (after this change)

```text
Sales/FreeTrial page
   → Stripe Checkout (7-day trial)
   → /auth?signup=true&paid=true   (account creation form)
   → Account created successfully
   → /welcome   ← NEW celebration page (conversion fires here)
   → "Let's set up your brand" CTA
   → /onboarding  (existing brand wizard)
```

Users who already have an account and just log in will **never** see `/welcome` — it's strictly a first-signup destination, which keeps the Meta conversion clean.

### What the /welcome page looks like

A warm, editorial, Vogue-meets-marketing-bestie celebration screen:

- Animated confetti / sparkle moment on load (using existing `framer-motion` already in the project)
- Big headline: **"You're in. Welcome to Lumi."**
- Subhead: a warm 1–2 line congratulations referencing their 7-day trial
- 3 quick "what happens next" tiles:
  1. Tell us about your brand (2 min)
  2. Connect your Meta account
  3. Launch your first campaign with Lumi's help
- A single primary CTA button: **"Let's set up your brand →"** linking to `/onboarding`
- Small secondary link: "Skip for now" → `/dashboard`
- Footer reassurance: "Your trial started today. You won't be charged until [date+7]."
- Lumi avatar / SparkleIcon to keep brand tone consistent

The page uses the existing design tokens, `LadybugIcon` / `SparkleIcon`, and `framer-motion` animations already used on `FreeTrial.tsx` for visual consistency.

### Meta tracking implementation

The `/welcome` page will fire two tracking signals so you can use whichever you prefer in Ads Manager:

1. **URL-based custom conversion** — set up in Meta Ads Manager: "URL contains `/welcome`". This is the simplest method, no code changes needed in Meta's dashboard beyond creating the conversion rule.
2. **Pixel `CompleteRegistration` standard event** — fired via `window.fbq('track', 'CompleteRegistration')` on page mount, only if `fbq` is present on the window. This gives you a named standard event in addition to the URL match.

Both fire exactly once per page mount, and only on this page, so you get a clean count of new signups.

### Technical changes

1. **New file: `src/pages/Welcome.tsx`**
   - Reads `?source=signup` (or similar) param to optionally personalize copy
   - Fires `fbq('track', 'CompleteRegistration')` on mount inside a `useEffect`, guarded by `typeof window.fbq === 'function'`
   - Sets `document.title` to "Welcome to Lumi" and a canonical `<link>` for SEO hygiene
   - Sessionstorage flag `lumi_welcomed=true` set on mount so accidental refresh/back-button doesn't re-fire the conversion in the same session
   - Uses `framer-motion` for the staggered reveal animation

2. **Edit `src/pages/Auth.tsx`** (signup branch only — lines ~128–133):
   - Replace `navigate("/onboarding")` with `navigate("/welcome")` for the **signup-with-session** case
   - Login flow is untouched
   - Email-confirmation case (no session) is untouched — those users hit `/welcome` after they confirm via the existing `emailRedirectTo` flow, which we'll update to `${window.location.origin}/welcome`

3. **Edit `src/App.tsx`**:
   - Import `Welcome` from `./pages/Welcome`
   - Register `<Route path="/welcome" element={<Welcome />} />` above the catch-all

4. **No edge function or database changes** — this is a pure front-end addition. No Stripe webhook changes; the trial is already created at checkout.

### How you set it up in Meta after this ships

1. Go to Events Manager → Custom Conversions → Create
2. Rule: **URL contains `/welcome`**
3. Category: **Complete Registration**
4. Optionally also use the standard `CompleteRegistration` pixel event we fire
5. Use this conversion as the optimization goal on your Lumi acquisition campaigns

### Files touched

- `src/pages/Welcome.tsx` (new)
- `src/pages/Auth.tsx` (edit signup redirect + emailRedirectTo)
- `src/App.tsx` (add route)

