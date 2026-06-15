## Goal
When a user starts a campaign from the Strategy Plan (e.g. "Education"), keep that campaign type all the way through `/create`, instead of falling back to the offer's recommended template or "Sales".

## Changes

### 1. `src/pages/StrategyPlan.tsx` — `startCampaign(idx)`
Pass the full strategy step into the URL and into the CampaignDraft:
- Add URL params: `campaignIdx`, `objective`, `campaignName` (alongside existing `from=strategy` and `goal`).
- Call `useCampaignDraft().setStrategy({ campaignIndex: idx, campaignName, goal, objective, audience, creative_brief, slug: plan.slug, name: plan.name })` before navigating.

### 2. `src/pages/Create.tsx` — respect the strategy campaign
- Read new query params: `objective` (strategyObjective), `campaignName`, `campaignIdx`. Keep existing `from=strategy` / `goal` handling.
- Add helper `pickStrategyTemplate(templates, strategyObjective, campaignName)`:
  1. Exact match on `template.objective === strategyObjective`.
  2. Fuzzy match on `template.name` / `template.slug` containing the objective or campaign name (case-insensitive).
  3. Otherwise return `null` (leave selection untouched).
- In the offer→template `useEffect` (lines 338–359): when `fromStrategy && strategyObjective` is present, skip both the `offer.recommended_template_id` override and the `objective === "Sales"` fallback. Use `pickStrategyTemplate` instead and only set if it returns a template.
- Once templates load and `fromStrategy && strategyObjective`, run `pickStrategyTemplate` to seed `selectedTemplateId` / `recommendedTemplate` immediately (so the choice sticks before an offer is picked, and re-applies after one is).

### 3. No other changes
- No edits to `recommend-strategy`, offer schema, or non-strategy entry points.
- CampaignDraftContext already supports arbitrary keys on `DraftStrategy` (it's `[key: string]: any`), so no type changes needed.

## Why this fixes it
Today, selecting an offer triggers the effect at lines 338–359 which always sets the template from `offer.recommended_template_id` (usually Sales). The new branch keeps the strategy plan's chosen campaign type authoritative when the user arrived via `from=strategy`, and the CampaignDraft persistence makes it survive route changes into `/creative` and `/launch`.