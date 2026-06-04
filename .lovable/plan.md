## Goal

For every B-Roll concept in the Production Checklist, stop generating long shot lists and creative direction (that lives in the Creative Toolkit B-Roll Library now). Keep one short "vibe" pointer, and put all the energy into **text overlays** that are on-brand, scroll-stopping, and built to convert.

## Files to change

1. `supabase/functions/generate-creative-grid/index.ts` — the prompt that builds the 9-cell grid
2. `supabase/functions/regenerate-creative-cell/index.ts` — the prompt used when a cell is regenerated
3. `src/components/creative/ProductionChecklistPanel.tsx` — small UI changes for broll cards

## 1. Reframe the B-Roll cell (both prompts)

Replace the long "B-ROLL FORMAT — LOFI EVERYDAY FOOTAGE" sections (philosophy + "what to suggest" + "what NOT to suggest" lists + 3–5 shot ideas) with a short block that says, in agent voice:

> "The user will pull the actual footage from their **B-Roll Library** in the Creative Toolkit. You are NOT writing a shot list or directing the shoot. You give them ONE short vibe pointer (e.g. 'warm morning desk' or 'walking + golden hour') so they know which clip to grab. The real deliverable here is the TEXT OVERLAYS."

Concretely:

- Drop the long shot inspiration list and the "what NOT to suggest" list.
- Replace `broll_shots` (array of 3–5) with a single `broll_vibe` string — max ~8 words, names the mood / setting only.
- Update the `Column 2: broll` description and the "REQUIRED OUTPUT FIELDS" block so `broll_vibe` is what's required and the text overlays are the star.
- Update the example output to show one `broll_vibe` line + a stronger overlay sequence.

## 2. New "TEXT OVERLAY EXCELLENCE" block (both prompts)

Replace the existing one-line overlay note with a focused playbook the model must follow. Rules:

- **Voice**: Mirror the brand voice samples passed in `brandContext`. Read like a sharp human texting one person, never a marketer. (Same voice rules as `compose-ad`.)
- **Length**: Headlines ≤ 27 chars (per existing Copy Constraints). Body overlays ≤ 14 words. Punchy, one breath each.
- **Sequence (4–6 overlays, in order)**:
  1. **Hook** (0–3s) — pattern-interrupt or specific micro-moment ("My 3rd call this week. Same objection.")
  2. **Pain / agitation** (3–7s) — one concrete pain from the audience psychology.
  3. **Pivot / insight** (7–12s) — the reframe ("It's not your offer. It's the script.").
  4. **Proof or specific outcome** (12–18s) — a number, a real result, a name — ties to the offer.
  5. **CTA** (last 3s) — matches the offer ("Save my seat" / "Get the guide" / "Book a call"). Never "Learn more" / "Click here".
- **Banned phrases** (instant fail): "learn more", "click here", "unlock", "transform", "next level", "secret", "game-changer", "ready to", "are you tired of", "supercharge", "level up", + the existing hype-word list from LUMI voice memory.
- **Specificity rule**: Every overlay must name a real number, name, moment, or feeling. No generic claims.
- **Brand cues**: If the brand has a signature phrase, recurring metaphor, or signature CTA in `brandContext`, use it.
- **On-brand sign-off**: Last overlay should pair the CTA with the brand name or signature line when natural.

Each overlay object stays `{ text, timing, type }` with `type` ∈ `hook | pain | insight | proof | cta`.

## 3. Output shape changes

For `broll` cells (in both prompts and their example outputs):

```text
{
  "format": "broll",
  "hook": "<one specific sentence>",
  "broll_vibe": "warm morning desk, natural light",
  "text_overlays": [
    { "text": "...", "timing": "0-3s", "type": "hook" },
    { "text": "...", "timing": "3-7s", "type": "pain" },
    { "text": "...", "timing": "7-12s", "type": "insight" },
    { "text": "...", "timing": "12-18s", "type": "proof" },
    { "text": "...", "timing": "18-22s", "type": "cta" }
  ],
  "mood": "Relatable",
  "psychology_trigger": "...",
  "pain_point_addressed": "...",
  "why_this_works": "..."
}
```

`broll_shots` is removed from the required fields (kept optional in the TS type to stay backward-compatible with existing saved cells).

## 4. UI tweaks in `ProductionChecklistPanel.tsx`

- Add optional `broll_vibe?: string` to `CreativeItem`.
- For `format === "broll"` cards: render a one-line "B-Roll vibe: {broll_vibe}" pill, followed by a small inline link **"Grab footage from your B-Roll Library →"** that routes to the Creative Toolkit B-Roll page.
- Keep the existing Text Overlays section but bump it visually (slightly larger heading, a short subline "Powered by your brand voice — this is what sells the ad.") so it reads as the primary deliverable, not a side note.
- Continue rendering `broll_shots` if present on older cells (backward compatibility), but collapsed under a small "Older shot ideas" expandable.

## 5. Out of scope

- No DB migration. The `text_overlays` and (optional) `broll_vibe` fields ride on the existing JSON cell payload.
- `generate-broll-ideas` (the standalone B-Roll Library generator) is left alone — that IS the toolkit the production checklist now points to.
- No changes to talking-head or graphic/carousel formats.
