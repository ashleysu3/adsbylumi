# LUMI Strategy Recommendations

Add a third card on the Create page that lets LUMI recommend a complete multi-campaign strategy based on the user's brand, industry, and website — feeling like they're being told exactly what to do next.

## 1. Third option on the Create page (`src/pages/Create.tsx`)

Add a third card above the existing two, styled as the hero/recommended choice:

- **Title:** "Let LUMI recommend my strategy"
- **Subtitle:** "Tell us your goal — we'll build the exact campaign plan for your business"
- **Badge:** "Recommended"
- **Icon:** Sparkles, gradient background matching the lumi palette
- **Action:** navigate to `/recommended-strategy`

## 2. New `recommended_strategies` table (admin-managed)

Pre-determined strategies keyed by business type. Admin CRUD in the admin dashboard.

```text
recommended_strategies
  id uuid pk
  slug text unique           -- e.g. "wedding-services-leads"
  name text                  -- "Wedding Pros — Grow + Leads"
  industry text[]            -- ["wedding", "photographer", "event-planner"]
  business_model text[]      -- ["service", "local-service"]
  primary_goals text[]       -- ["book_calls", "grow_social"]
  keywords text[]            -- match signals from website content
  description text           -- user-facing explanation
  why_it_works text          -- LUMI's rationale
  campaigns jsonb            -- array of {name, objective, goal, audience, budget_pct, creative_brief}
  is_active boolean default true
  created_by uuid
  created_at, updated_at
```

RLS: authenticated SELECT on active rows; admin INSERT/UPDATE/DELETE via `has_role(auth.uid(), 'admin')`. Public-schema GRANTs included.

## 3. New `strategy_requests` table (fallback)

When no template matches, log it for admin and email them.

```text
strategy_requests
  id uuid pk
  user_id uuid
  brand_id uuid
  brand_snapshot jsonb       -- name, website, industry, offers, audiences
  user_goal text
  status text                -- 'pending' | 'answered' | 'dismissed'
  admin_response jsonb       -- filled in later, can be promoted into recommended_strategies
  created_at, responded_at
```

Admin can view, respond, and "promote to template."

## 4. Recommendation edge function `recommend-strategy`

Input: `{ brand_id }`. Steps:
1. Load brand, offers, audiences, website auto-summary.
2. Fetch all active `recommended_strategies`.
3. Use Lovable AI (`google/gemini-3-flash-preview`) with `Output.object` to score matches against industry/business_model/keywords and pick the best template **or** return `no_match: true` with a short reason.
4. If matched: return the template plus a personalized intro paragraph.
5. If no match: insert a `strategy_requests` row, send an email to the admin notification address via existing email infra, and return `pending: true`.

## 5. New page `/recommended-strategy` (`src/pages/RecommendedStrategy.tsx`)

Flow (clean, one decision at a time):
1. **Brand confirm** — show detected industry/business type from brand profile. "Is this you?" with edit link.
2. **One question:** "What's your #1 goal right now?" (uses the same goal chips as Create step 1).
3. **LUMI is thinking** loading state — calls `recommend-strategy`.
4. **Result screens:**
   - **Matched:** Hero card with strategy name, "Why this works for you" paragraph, then the campaign cards (e.g. "Campaign 1: Grow on Instagram" + "Campaign 2: Lead form fills") each with objective, audience, suggested budget split, and a creative brief preview. CTA: **"Build this strategy"** → routes into existing campaign build flow with the campaigns pre-filled.
   - **Pending:** Friendly screen: "LUMI is putting together a custom plan for your business. We'll email you within 1 business day." Button to set a reminder / go back to dashboard. Show the request id.

## 6. Admin dashboard additions

Under existing admin routes:
- `/admin/strategies` — list, create, edit, archive `recommended_strategies`. Form fields match the schema; campaigns edited as a structured repeater (name, objective, goal, audience, budget %, creative brief).
- `/admin/strategy-requests` — inbox of pending requests with brand snapshot. Actions: "Respond" (write a custom strategy JSON → emails the user, marks answered), "Promote to template" (prefill the new-template form), "Dismiss."

## 7. Admin email notification

Reuse existing transactional email setup. On new `strategy_requests` insert (DB trigger calling an edge function, or function-side after insert), send `admin@adsbylumi.com` an email with brand info and a link to `/admin/strategy-requests`.

## 8. Seed data

Seed 3 starter templates so the feature feels alive on day one:
- Wedding / event service pros → Grow IG + Lead form (2 campaigns)
- Coaches & course creators → Training + Cold + Warm (3 campaigns, matches existing After Organic framework)
- Local service business → Local awareness + Lead form (2 campaigns)

## Technical notes

- Goal chips: reuse the existing `selectedGoal` options from `Create.tsx` (extract into a shared constant).
- Campaign build hand-off: pass `recommendedStrategyId` in query params; existing build flow reads it and pre-populates campaigns + creative briefs.
- AI matching uses structured output (`Output.object` with zod) — no manual JSON parsing.
- All new tables include GRANTs and RLS in the same migration.
- Edge function follows project standards (Deno.serve, npm:@supabase/supabase-js@2, CORS, 200 + JSON error body).
- No changes to billing or tier limits in this scope.

## Out of scope (for follow-ups)

- Multi-language strategies
- Strategy A/B variants
- Auto-execution without user review (always show the plan first)
