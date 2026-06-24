# Lead-Fit Feedback Loop

Three connected pieces. Diagnose + draft only — no changes to billing or Meta execution.

## Part A — Capture: "How are the leads?"

**New table `lead_quality_feedback`**
- `id, workspace_id, campaign_id (meta), brand_id, user_id, fit_rating ('right'|'mixed'|'wrong'), reasons text[], note text, created_at`
- Allowed reasons: `cant_afford`, `too_beginner`, `just_browsing`, `wrong_niche`, `only_want_free`
- RLS: brand-owner only via `brands.user_id = auth.uid()`; service_role full.

**New component `LeadQualityCheck`** (`src/components/insights/LeadQualityCheck.tsx`)
- One-tap row: 🎯 Right people / 🤷 Mixed / 👎 Wrong people
- On Mixed/Wrong: chips for the 5 reasons + one-line note + Submit
- Soft "How are the leads going?" prompt shown when no feedback in the last 10 days for that campaign; otherwise collapsed under a small "Update lead quality" link (always available)
- On Mixed/Wrong submit → fire-and-forget invokes `ad-fit-review`, toasts "LUMI is reviewing your copy — we'll drop a re-aimed version on Live Ads"

**Surfaces**
- `src/pages/Performance.tsx`: render at bottom of each campaign card (compact)
- `src/pages/CloserLook.tsx`: render full version in main column

## Part B — Diagnose + Re-Aim

**New edge function `ad-fit-review`** (`verify_jwt = true`)
Input: `{ workspace_id, brand_id, feedback_id }`
Loads:
- workspace ad copy from `campaign_workspaces` (headline/primary/description) + linked creatives if present
- `brands.audience_psychology`, brand voice
- linked offer (price, type) from `offers`
- KB doc "Audience fit — who your copy attracts" (Part C)
- The submitted feedback row

Calls Lovable AI (`google/gemini-2.5-flash`) with the attractor-signals taxonomy. Returns structured JSON:
```
{
  fit_score: 'A'|'B'|'C'|'D'|'F',
  attracts: string,           // who the current copy attracts
  leaking_phrases: [{quote, why}],
  creative_mismatch: string|null,
  ideal_buyer_summary: string,
  ideal_buyer_thin: boolean,  // if true, ask user to confirm rather than guess
  rewritten: { headline, primary, description, repels_note },
  creative_changes: string|null
}
```

**Persistence as task** — write a `tasks` row:
- `action_type = 'ad_fit_review'`
- `action_payload = { workspace_id, brand_id, feedback_id, review: <json above> }`
- `link_to = /live-ads/:workspace_id`
- `title = "Great CPL — but the leads feel off. Here's a re-aimed version."`

**New dialog `AdFitReviewDialog`** (opened from the task row in `LumiRecommendations`/Closer Look)
- Shows fit score, who-it-attracts, quoted leaking phrases, ideal buyer
- Side-by-side current vs rewritten copy
- "Use this copy" → copies to clipboard, saves into `creative_bench` as a draft variant, marks task done
- "Open creative flow" → navigates `/creative-studio?workspaceId=…&fitReviewId=…` and marks task done
- If `ideal_buyer_thin`, show a short confirm step ("Quick check: who do you actually want?") before generating — gets stored back to `brands.audience_psychology.ideal_buyer_note`

**Wire-in**
- `LumiRecommendations` already pulls from tasks-style sources; add a small inline render for `action_type === 'ad_fit_review'` tasks on Performance.tsx + CloserLook.tsx.

## Part C — Proactive Fit Filter

**KB seed (migration)** — insert `knowledge_documents` row:
- `category = 'psychology'` (existing allowed category, already read by copy/angle generators)
- `subcategory = 'audience_fit'`, `tags = ['fit','attractor','audience']`
- `title = "Audience fit — who your copy attracts"`
- Body: full attractor-signals taxonomy
  - Wrong-fit magnets: price-shopper, beginner, tire-kicker, overpromise, vague-everyone (definitions + sample leaking phrases)
  - Right-fit magnets: specificity, identity/level markers, investment framing, sophisticated problem, "not for you if", proof of caliber
  - **Calibration rule** (called out explicitly): judge against who the brand *wants*. Beginner/cheap framing is only wrong for premium offers; a real low-ticket/beginner offer should keep it.

**Fit-check pass in `generate-advanced-copy`**
After variations are generated, run a second model call:
- Inputs: each variation + brand ideal buyer + offer price/type + the attractor-signals doc
- Output per variation: `{ fit_score: 'A'..'F', attracts, wrong_fit_phrases:[{quote,why}], right_fit_suggestions:[string] }`
- Sort variations so highest-fit appear first; attach `fit` to each in the response

**UI surface** (lightweight)
- In any component that renders generated copy variations, show a small `<FitBadge score="A" attracts="…" />` and tooltip with wrong-fit phrases + suggestions. Scope to where `generate-advanced-copy` results are rendered (no other UI rewrites).

## Files

New:
- `supabase/migrations/<ts>_lead_fit_loop.sql` (table + RLS + grants + KB seed)
- `supabase/functions/ad-fit-review/index.ts`
- `src/components/insights/LeadQualityCheck.tsx`
- `src/components/insights/AdFitReviewDialog.tsx`
- `src/components/insights/FitBadge.tsx`

Edited:
- `supabase/config.toml` — register `ad-fit-review` with `verify_jwt = true`
- `src/pages/Performance.tsx` — render `<LeadQualityCheck>` per card + surface `ad_fit_review` tasks
- `src/pages/CloserLook.tsx` — render `<LeadQualityCheck>` + surface review task
- `supabase/functions/generate-advanced-copy/index.ts` — fit-check pass, return per-variation `fit`
- Component that renders `generate-advanced-copy` output — add `<FitBadge>` (will identify when editing)

## Out of scope
No billing changes. No Meta execution changes. `ad-fit-review` never pushes copy to Meta; it only drafts.
