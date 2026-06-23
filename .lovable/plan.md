# Plan: Business-Model Archetype Framework Layer

A new layer above templates that sets each brand's operating model and drives budget + success-metric defaults. Five archetypes: `lead_gen_funnels`, `low_ticket_direct`, `high_ticket_consult`, `ecommerce`, `community_membership`.

## 1. Archetype config (single source of truth)

New file `src/lib/business-archetypes.ts` — TypeScript config, no DB table needed (archetypes are global, not per-tenant). Each archetype carries:

- `slug`, `label`, `tagline`
- `budgetApproach`: `{ testDaily: {min,max}, scaleTrigger, scalingRule, retargetMultiplier?, launchWindowOnly? }`
- `successMetrics`: array of `{ key, label, target, isPrimary }` — e.g. `opt_in_rate`, `show_up_rate`, `live_conversion`, `cost_per_application`, `cost_per_member`, `roas`
- `gradingNotes`: rules that override generic grading (e.g. "do NOT grade lead_gen on webinar ROAS — grade on LTV from list")
- `templateSlugs`: array of strategy template slugs that belong under it
- `diagnose(offer)`: returns confidence score given offer price + type + goal

Exported helper `diagnoseArchetype({ price, offerType, goal })` returns the best-match slug + confidence + an explanation string.

## 2. Schema migration

Add to `public.brands`:

- `business_model text` (nullable; one of the 5 archetype slugs)
- `business_model_confirmed_at timestamptz` (so we know the user accepted it vs. it being an auto-guess)

No new table — the 5 archetypes are code-level constants. No grants needed (existing brand grants already cover the column).

## 3. Diagnosis UI

**Onboarding (`BrandOnboardingWizard.tsx`)** — after offer + price are captured, insert a lightweight "Looks like you're running **{archetype}**" confirm card. Two actions: "Yes, that's me" (writes `business_model` + `business_model_confirmed_at`) or "Change" (opens a 5-option selector with the archetype label/tagline).

**Strategy page (`Strategy.tsx`)** — same card at the top of the page. If `business_model` is null, show the diagnosis prompt. If set, show "Operating as **{archetype}** · Change" with a popover to switch.

Reusable component: `src/components/ArchetypeDiagnosisCard.tsx` (handles both surfaces).

## 4. Budget wiring (`src/lib/strategy-budget.ts`)

Extend `StrategyBudgetInput` with optional `archetypeSlug`. When present:

- Use the archetype's `budgetApproach.testDaily` as the **floor range** for `leanDaily`/`idealDaily` on the primary main campaign (overrides KPI-derived defaults; still respects the template-level `budgetSuggestion` when that one is tighter).
- When the archetype defines `retargetMultiplier` (e.g. ecommerce 2–3×), apply it to supplemental retargeting allocations instead of the generic 15% rule.
- When `launchWindowOnly` is true (community_membership), tag the rationale string with "Run only during open-enrollment windows (2–4/yr)" and skip the always-on monthly projection.
- Scaling rule note ("test → ~50 conversions → scale +20%") is surfaced in the `rationale` string so the user sees it in the budget panel.

Callers (`Strategy.tsx`, `StrategyPlan.tsx`, `CloserLook.tsx`, `Performance.tsx`, `recommend-strategy` edge function) pull `brand.business_model` and pass it through. Back-compat: if absent, current behavior is unchanged.

Unit tests added to `strategy-budget.test.ts` for each archetype's floor + scaling note.

## 5. Success metrics wiring

**`src/lib/goal-suggestions.ts`** — new `getArchetypeGoalSuggestions(archetypeSlug, objective)` that returns the archetype's `successMetrics` as the suggested primary/secondary/tertiary KPIs (with target values). Existing generic suggestions remain as fallback.

**`GoalSetupModal.tsx`** — when opened, pull the brand's archetype and pre-fill KPI dropdowns + target values from `getArchetypeGoalSuggestions`. User can still override (user-set goals remain truth).

**`evaluate-campaign-status` edge function** — accept `archetypeSlug` in the request body. When present, use the archetype's `successMetrics` and `gradingNotes` to drive grading:

- `lead_gen_funnels`: grade on opt-in / show-up / live-conversion rates and LTV-from-list. Do NOT fail a webinar campaign on weak ROAS alone — surface as "ROAS is informational; LTV is the real read."
- `community_membership`: grade on cost-per-member + retention; only evaluate during launch windows.
- `high_ticket_consult`: grade on cost-per-application + application→call + call→close, not raw CPL.
- `ecommerce`: grade on ROAS + CAC + repeat-customer.
- `low_ticket_direct`: grade on cost-per-purchase + conversion rate.

Keep MRR/LTV-aware judgment intact. User-set goals (from `campaign_goals`) always win — archetype only sets defaults and fills in unspecified KPIs.

## 6. Out of scope

- Meta execution (build-meta-campaign, update-meta-budget) — unchanged
- Billing / Stripe — unchanged
- Lumi Engine internals — unchanged
- No new templates (ecommerce templates intentionally TBD; framework seeded only)
- No changes to template seeding from the prior round

## Files touched

- **New:** `src/lib/business-archetypes.ts`, `src/components/ArchetypeDiagnosisCard.tsx`, migration adding `business_model` to `brands`
- **Edited:** `src/lib/strategy-budget.ts` (+ tests), `src/lib/goal-suggestions.ts`, `src/components/insights/GoalSetupModal.tsx`, `src/components/BrandOnboardingWizard.tsx`, `src/pages/Strategy.tsx`, `supabase/functions/evaluate-campaign-status/index.ts`, `supabase/functions/recommend-strategy/index.ts`, and the budget call sites that already have `brand` in scope (`StrategyPlan.tsx`, `CloserLook.tsx`, `Performance.tsx`)
