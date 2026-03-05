

## Plan: Fix Spelling & Grammar Check for Ad Copy Context

### Problem

Two related issues:

1. **QA prompt is wrong for ad copy** — The spelling/grammar AI prompt treats copy like formal writing. In ads, numbers should NOT be spelled out ("7 days" not "seven days"), sentence fragments are intentional, and casual/punchy style is expected. The current prompt flags these as errors, making Lumi look like it's correcting its own work.

2. **Generation functions lack ad-copy conventions** — The copy generation prompts (generate-angle-copy, generate-creative-grid, generate-copy-variations) don't explicitly instruct the AI to use ad-copy best practices like using digits instead of spelled-out numbers. Adding a brief rule set to generation will reduce QA issues at the source.

### Changes

#### 1. Rewrite QA spelling prompt — `supabase/functions/qa-preflight-check/index.ts`

Replace the current generic "copy editor" prompt with an ad-copy-aware prompt that:
- Explicitly allows numbers as digits (never flag "7" vs "seven")
- Allows sentence fragments, one-word sentences, mid-sentence starts
- Allows informal punctuation (ellipsis, dashes, no Oxford comma)
- Allows ALL CAPS for emphasis words
- Only flags genuine typos (misspelled words), broken grammar that would confuse readers, and missing/wrong punctuation that changes meaning
- Frames itself as "checking readability for a social media feed audience" not "formal proofreading"

The threshold should be high — only flag things that would make the brand look unprofessional or confuse the reader.

#### 2. Add ad-copy conventions to generation prompts

Add a small, consistent rules block to these three edge functions:
- `supabase/functions/generate-angle-copy/index.ts`
- `supabase/functions/generate-creative-grid/index.ts`  
- `supabase/functions/generate-copy-variations/index.ts`

The rules block:
- Always use digits for numbers (7 not seven, $997 not $nine hundred ninety-seven)
- Keep sentences punchy and scannable
- No filler words
- Double-check spelling of common words

This ensures copy is generated correctly from the start, so QA finds minimal issues.

### Files Modified
- `supabase/functions/qa-preflight-check/index.ts` — rewrite spelling prompt
- `supabase/functions/generate-angle-copy/index.ts` — add ad-copy conventions
- `supabase/functions/generate-creative-grid/index.ts` — add ad-copy conventions
- `supabase/functions/generate-copy-variations/index.ts` — add ad-copy conventions

