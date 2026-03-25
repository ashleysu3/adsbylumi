

## Purge All Landing Page / Retargeting / Non-Ad Recommendations from AI Prompts

### Problem
The `generate-client-report` prompt already has the prohibition, but two other AI-powered edge functions still reference landing pages and retargeting in their prompts, which means the AI can still produce those recommendations:

1. **`analyze-performance/index.ts`** — The prompt explicitly mentions "landing page performance" in the NURTURE stage, "Warm Audience Health" for retargeting audiences, and "offer/landing page mismatches"
2. **`generate-review-action-plan/index.ts`** — No explicit prohibition, so the AI can freely suggest landing page or retargeting advice

### Plan

**1. Update `analyze-performance/index.ts` prompt** (lines ~199-213)

- Remove "landing page performance" from the NURTURE stage description → replace with "Click-to-conversion, ad-to-action clarity"
- Remove section 4 "Warm Audience Health" entirely (retargeting audience evaluation)
- Remove "landing page" from section 6 "Offer Diagnosis" → keep only "identify mismatches between the offer and creative"
- Add a PROHIBITED ADVICE block (same as `generate-client-report`): never recommend landing page changes, retargeting, lookalike audiences from retargeting pools, or remarketing
- Renumber remaining sections

**2. Update `generate-review-action-plan/index.ts` prompt** (lines ~58-65)

- Add a PROHIBITED ADVICE block before the "Generate:" section:
  - "NEVER recommend landing page changes or optimization"
  - "NEVER recommend retargeting campaigns or remarketing strategies"
  - "Focus only on: creative refreshes, budget adjustments, audience testing with broad/interest targeting, copy angles, campaign structure"

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/analyze-performance/index.ts` | Remove landing page and retargeting references from prompt; add prohibited advice block |
| `supabase/functions/generate-review-action-plan/index.ts` | Add prohibited advice block to prompt |

