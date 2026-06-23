# Plan: New Strategy Templates + Positioning-Aware Generators

## 1. Schema migration (campaign_templates)

Add two columns:
- `type` text default `'funnel'` with check (`'funnel'`, `'addon'`)
- `positioning_brief` jsonb (shape: `{ angle_intent, awareness_level, say, never_say }`)

## 2. Seed 7 templates

I'll seed via the same migration (idempotent `INSERT ... ON CONFLICT (slug) DO UPDATE`). Each row will include:
- `journey_stages` / `campaign_structure` describing number of campaigns and each stage's objective, optimization_event, and cold/warm/sale role
- `kpi_benchmarks` with primary KPI per stage (and notes like "MRR-aware" / "judged on booked calls, not raw cost" / "judged on cost-to-warm, not conversions" / "no podcast download tracking")
- `budget_suggestion`
- `positioning_brief` exactly as specified in the request

**Funnel templates (`type='funnel'`):**
1. `lead-magnet-cold` — Lead Magnet (Leads, CPL ~$2–8)
2. `webinar-cold` — Webinar / Free Training (Leads → warm retarget to offer)
3. `paid-challenge-cold` — Paid Challenge (Sales, MRR-aware)
4. `podcast-grow` — Podcast Grow + Capture (Video Views → retarget Leads/Traffic)
5. `dm-conversations` — Direct Conversational Starters (Messages, judged on booked calls)

**Add-on templates (`type='addon'`):**
6. `warmup-social` — Warm-Up (3 variants: Traffic / Engagement / Video Views)
7. `event-geo` — Event / Geo (geo'd ad set or standalone)

## 3. Strategy budget wiring (`src/lib/strategy-budget.ts`)

- Extend `BudgetCampaignInput` with optional `templateSlug` / `budgetSuggestion` (string or `{min,max}` shape stored on the template).
- When sizing the funnel, if the active template provides a `budget_suggestion`, use it as the floor for `mainDaily` and `leanDaily` instead of the generic KPI-based default.
- Keep current behavior as fallback when no template hint is passed.

## 4. Generator wiring (positioning_brief → AI prompts)

For each of: `generate-creative-angles`, `compose-ad`, `finalize-ad-copy`, `generate-angle-copy`:
- Accept optional `positioningBrief` in the request body (forwarded by callers that already pass strategy/template context).
- When present, inject a `POSITIONING BRIEF` block into the system prompt with `angle_intent`, `awareness_level`, `say` (must-include language), `never_say` (banned phrasing) — and instruct the model to make these override the generic objective→tone mapping.
- When absent, behavior is unchanged (back-compat).

Frontend callers that already resolve a selected template (strategy/creative flows) will pull `template.positioning_brief` and pass it through. I'll only touch the call sites that already have the template in scope (no new prop drilling beyond that).

## 5. Out of scope (explicitly not touched)

- Billing / Stripe
- Meta execution (campaign build, budget update edge functions)
- Lumi Engine
- No changes to recommendation/optimization logic

## Technical notes

- Migration uses `ON CONFLICT (slug) DO UPDATE` so re-running is safe and existing rows get the new fields populated where slugs collide.
- All new templates set `active=true` and reasonable `sort_order` (funnels 50–54, addons 90–91) so they don't reorder existing templates.
- The two new columns are additive; existing rows get `type='funnel'` and `positioning_brief=NULL` and continue to work.
