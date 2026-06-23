# Guided Onboarding Flow

Replace `/onboarding` with a 5-step wizard that pulls a new signup all the way to a launch-ready first campaign. Every step reuses existing edge functions and tables. Anything the user skips becomes a task in the tray. The wizard is resumable from where they left off and ends on `/home`.

## User experience

```text
SIGN UP
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  /onboarding  (single page, 5 internal steps + progress)    │
│                                                              │
│  1. Business basics  ──►  Required: name, website, offer    │
│     + Connect Meta        URL(s), Meta OAuth                │
│                                                              │
│  2. "LUMI is reading your site…" (parallel extraction)      │
│     Review + edit cards:                                     │
│       · Design guide (colors + fonts)                        │
│       · Brand voice                                          │
│       · Audience psychology                                  │
│       · Offer psychology                                     │
│       · Social proof                                         │
│     Each card editable, none ever blank.                     │
│                                                              │
│  3. Assets & approval                                        │
│     Harvested brand_assets grouped by role (logo /           │
│     background / texture / graphic / lifestyle). Toggle      │
│     "kept", remove, upload more. SetupPrompts for missing    │
│     logo, headshot, backgrounds, b-roll, voice example.      │
│                                                              │
│  4. Suggested strategy                                       │
│     recommend-strategy result shown plainly. "Add these      │
│     steps to my tasks" seeds the tray.                       │
│                                                              │
│  5. First-campaign walkthrough                               │
│     Hand off to /create with the campaign tasks already in   │
│     the tray. "I'll do it later" lands on /home.             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       /home (launchpad)
```

Required: step 1 + Meta connect. Steps 2–5 each have a **Finish later** button that creates a task and advances.

## Reuse — no rebuilding

- Edge functions: `extract-brand`, `extract-offer-info`, `harvest-brand-assets`, `analyze-brand-voice`, `generate-audience-psychology`, `generate-product-psychology`, `recommend-strategy`.
- Components: `MetaAccountConnect`, `SetupPrompt`, `LumiThinkingInline`, `BrandImageLibrary` (read patterns), `Card`, `Button`, etc.
- Tables: `brands`, `offers`, `brand_assets` (role + kept), `user_assets`, `tasks`.
- Hooks: `useTasks` for tray inserts, `useBrand` for active brand context.

## What gets built

### 1. New page: `src/pages/GuidedOnboarding.tsx`

Single component with `step` 1–5 state, header progress strip, and a sub-component per step:

- `Step1Basics` — name, website, comma-separated offer URLs, `MetaAccountConnect` embedded. Saves a `brands` row + one `offers` row per URL on **Continue**.
- `Step2Review` — on mount kicks off the six extraction calls in parallel against the new brand/offer ids. Shows the friendly "LUMI is reading your site…" state with `LumiThinkingInline` until results land, then renders five editable review cards. Each card writes its edits straight to the existing brand/offer columns on save.
- `Step3Assets` — queries `brand_assets` for the user grouped by `role`, lets the user toggle `kept`, delete, and upload (logo/headshot/background → `user_assets` for personal, `brand_assets` for brand-scoped). Renders a `SetupPrompt` for each missing essential (logo, headshot, ≥1 background, voice example, b-roll-to-record).
- `Step4Strategy` — calls `recommend-strategy`, renders the suggested plan, button "Add these to my tasks" inserts one row per next-step into `tasks` linked to `/strategy`.
- `Step5FirstCampaign` — short hand-off card with two buttons: **Start my first campaign** (→ `/create?onboarding=1`) and **I'll do it later** (→ `/home`). Either path seeds tasks for angle → copy → creative → launch first if they aren't already there.

Each step has Back / Continue / Finish later. Continue advances and persists `brands.onboarding_step`.

### 2. New shared helper: `src/lib/onboarding-tasks.ts`

`seedDeferredTask(kind, brandId)` — idempotent upsert into `tasks` keyed by `(user_id, source='guided_onboarding', title)`. Used by every "Finish later" path and by Step 3 SetupPrompts. Maps each missing item to a clear task title + `link_to` (e.g. `Add a logo` → `/brand`, `Approve your strategy` → `/strategy`, `Record your headshot video` → `/creative-studio`).

### 3. Routing + entry point

- `src/App.tsx`: keep route `/onboarding` pointing at the new page. The old `Onboarding.tsx` becomes `OnboardingLegacy.tsx` (kept in repo only for fallback reference — not routed).
- Post-signup / post-payment redirects already send users to `/onboarding`, so no caller changes.
- On mount, the page reads `profiles.guided_onboarding_step` (or active brand's `onboarding_step`) and jumps to that step so it's resumable.

### 4. Schema (one migration)

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guided_onboarding_step int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS guided_onboarding_completed_at timestamptz;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
```

No new tables — review state lives in the existing brand/offer columns the extractors already write to. No grants needed (both tables already have them).

### 5. "Never blank" enforcement

If any extractor fails or returns empty, the review card renders a `SetupPrompt` with a sensible default placeholder and lets the user fill it in. Saving is allowed with minimum-viable values; "Finish later" always creates a follow-up task.

## What I am NOT touching

- Meta OAuth flow itself (reused as-is).
- Billing / Stripe / pricing tiers.
- Existing `Create` campaign flow internals — only the entry point gets the new tasks pre-seeded.
- The legacy `Onboarding.tsx` extraction logic — we just stop routing to it.

## Acceptance check

1. New user signs up → lands on `/onboarding` step 1.
2. Fills basics, connects Meta → advances to step 2.
3. Sees the friendly "reading your site" state, then five editable cards. Approves or edits each.
4. Reviews harvested assets, uploads logo + headshot, removes one bad image.
5. Sees a recommended strategy and a "next steps in your tasks" confirmation.
6. Clicks **Start my first campaign** → lands in `/create` with angle/copy/creative/launch tasks in the tray.
7. Leaves and comes back → reopening `/onboarding` resumes at the last step they were on.
8. Clicks **Finish later** anywhere → tasks for the deferred items are visible in the tray on `/home`.
