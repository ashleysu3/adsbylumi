# Demo-day plan: make the first ad land every time

Demo brand: **catholicpsych.com**. Goal: nothing on stage looks broken, and the first ad is the "wow" moment.

## 1. Pinned demo result (the safety net)

Add a demo-mode escape hatch on the payoff screen so a bad live generation never shows on stage.

- A pre-generated, hand-approved ad for catholicpsych.com is stored as the pinned result for that domain.
- When the entered website matches a pinned demo domain, the payoff screen still plays the full "watching LUMI read you" sequence (same timings, same status lines, same reveal) but reveals the pinned ad instead of a fresh render.
- Live generation still runs behind the scenes, so if it comes back strong you can flip to it with a keyboard toggle; if it fails, nobody sees it.
- Pinned entries are admin-managed, keyed by normalized domain, so you can pin more brands before future demos.

## 2. Raise real first-ad quality

These fix the four failure modes you named, and they help every real user too, not just the demo.

**Bad or no brand image**
- Score photo candidates before picking one instead of taking `candidates[0]`: prefer larger images, real photography over icons/logos/sprites, and reject anything tiny, near-square favicon-sized, or transparent-heavy.
- If no candidate clears the bar, fall back to a text-forward template rather than rendering an ad around a bad image.

**Weak or off-brand copy**
- Generate the three copy options, then pick the default by a quality rubric (headline length within template limits, no generic filler openers, CTA matches the goal, brand name or offer actually referenced) instead of always defaulting to option 0.
- Keep all three visible so you can narrate the choice on stage.

**Ugly layout and colors**
- Guard the palette before render: enforce minimum contrast between text and background, and drop washed-out or near-white accents extracted from the site back to a safe on-brand pairing.
- Restrict the template pick to the ones the extracted assets can actually support (photo templates only when a photo passed the score, checklist only when a real offer exists).

**Inconsistent results**
- Add one silent retry on render failure before showing an error, and only surface the error state once both attempts fail.
- Make the reveal wait for the image to actually decode, so no half-loaded ad flashes on screen.

## 3. Demo-run hardening

- Pre-warm: run the flow once for catholicpsych.com before you go live so extraction results are cached and the demo path is fast.
- Confirm the pinned ad and the live path both render correctly at your presenting resolution.

## Technical notes

- Frontend work is concentrated in `src/components/onboarding/PayoffAdScreen.tsx` (photo scoring, template gating, palette guard, option ranking, retry, pinned-result branch) and `src/pages/GuidedOnboarding.tsx` for domain matching.
- Pinned demo ads: a small table keyed by normalized domain holding the image URLs, copy option, and template, with RLS allowing public read and admin write, plus an admin screen to add or replace entries.
- No changes to `compose-ad` behavior or the ad-kit data model; the ranking and guards sit on the client side of the existing calls.
