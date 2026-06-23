## What changes for the user

After they paste their website and click **Read my site**:

1. A full-screen Lumi loader takes over the whole window with the rotating witty copy. Nothing else is visible (no inline reveals, no progress bar peeking through). It stays up until everything has finished pulling: brand basics, voice, audience, design (colors/fonts/logo), social proof, and assets.
2. The app then auto-advances them into a **"Here's what we gathered"** sequence — one focused, editable card per topic, in this exact order:

```text
Brand basics  →  Audience  →  Design guide & images  →  Social proof  →  Your offer
```

Social proof is skipped automatically (both forward and back) when nothing was found — they can add it later from My Brand.

Every review step has a built-in **Edit** toggle so they can fix anything the website got wrong (rebrand, outdated copy, missing audience nuance, wrong fonts, etc.) before continuing. Back/Continue stays consistent across all steps.

After the offer step, the existing **Connect Meta** and **Strategy & launch** steps continue as they do today.

## New step map

```text
1. Drop your website      (full-screen loader during extraction → auto-advance)
2. Brand basics           name • what you do • brand voice
3. Audience               psychology (pain / wants / doubt) + demographics
4. Design guide & images  colors • fonts • logo + photos (existing photos UI folded in)
5. Social proof           skipped if nothing was pulled
6. Your offer             current offer flow
7. Connect Meta           unchanged
8. Strategy & launch      unchanged
```

## Edit-as-you-go pattern

Each review step uses the same pattern that's already on the Design and Social Proof cards: a clean read-only summary at the top with a small **Edit** button that swaps to inline inputs, plus a **Save** / **Cancel** pair. No surprises, same shape on every step.

## Technical details

- **`src/pages/GuidedOnboarding.tsx`**
  - Replace the `STEPS` array with the 8-step map above; bump `TOTAL`.
  - **Full-screen extraction overlay**
    - Add `extractionPhase: 'idle' | 'running' | 'done'`.
    - In `startStep1`, set phase to `running`, remove the toast-based rotator, and render `<LumiPageLoader>` (from `src/components/LumiLoader.tsx`) at the top level of the page whenever `extractionPhase === 'running'`. While running, hide the step card and progress header so nothing else shows.
    - Cycle the existing witty lines through the loader's `message` prop on a `setInterval`.
    - Add `extract-social-proof` to the parallel batch (currently fires on Step 2 mount). Wait for `Promise.allSettled` over brand + voice + audience + social-proof + assets, then set phase to `done` and `setStep(2)` so they land directly on Brand basics.
    - Keep the existing brand-reset logic when the website URL changes.
  - **New `BrandBasicsCard`** review component (in the same file, alongside `ReviewVoiceCard`): shows brand name, "what you do" (`value_proposition`), and brand voice with the standard Edit/Save toggle. Removes the need to look at Voice separately on Step 2.
  - **Audience step** uses the existing `ReviewAudienceCard`, extended to also render and edit `audience_psychology.demographics` (string) so the user sees "psychology + demographics" together.
  - **Design step** stacks `ReviewDesignCard` (colors/fonts) on top of the existing photos UI block (the categorized assets grid + classification + upload buttons). Pull that JSX out of today's Step 4 into a helper render so it can live under Design without duplicating logic. Keep all existing handlers (`toggleKept`, `removeAsset`, `setRole`, `uploadFile`, b-roll block).
  - **Social proof step** auto-skips when empty:
    - On step enter, if `social_proof` has no content and `proofExtracting === false`, call `advance()` immediately.
    - On back navigation into it, if empty, jump past it to the previous non-empty step.
  - **Offer step** keeps its current behavior.
  - Update the resume logic (`onboarding_step`) so older saved values map cleanly into the new step indexes (clamp into range; default forward to nearest review step).
- **No backend changes.** All extractors already exist; we're only reordering when results are surfaced and consolidating the loading state.
- **No schema changes.** `audience_psychology.demographics` already lives in the existing JSONB column.

## Out of scope

- Step copy polish beyond what's needed for the new ordering.
- Changes to Connect Meta and Strategy & launch.
- New AI prompts or extractors.