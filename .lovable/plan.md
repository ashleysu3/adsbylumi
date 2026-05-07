## Goal

Replace the existing text-only "Creative Fatigue" card on the campaign insight detail with a visual, plain-English gauge — like a car's oil-temp dial — that always shows fatigue status (green → red), explains what it means, and gives the user concrete next-action buttons.

## What the user will see

On `CampaignInsightDetail` (in `src/components/insights/CampaignInsightDetail.tsx`), the existing fatigue card is replaced with a richer "Creative Fatigue" card that contains:

1. **Gauge visual** (left side) — a 180° semicircle SVG arc colored green → yellow → orange → red with a needle pointing at the campaign's frequency. Zone labels: Healthy / Warming up / Refresh soon / Refresh now. Frequency number rendered large under the needle.
2. **Plain-English status block** (right side) — uses the existing `getFatigueStatus()` helper:
   - Bold status label (e.g., "Refresh soon")
   - One-line meaning ("Each person has seen your ad ~3.8 times…")
   - One-line "what to do next" recommendation
3. **Action row** (always visible) — three buttons:
   - **Refresh creative now** → existing `/creative?workspace={id}&refreshCreative=true` route
   - **Add to bench** → opens the existing `CreativeBenchPanel` "Add from Concepts" picker (we surface it via a small dialog or by scrolling to + opening the bench panel)
   - **Bench rules** → navigates to `/settings#fatigue` (the existing Alert Thresholds + Creative Automation sections in `Settings.tsx`)
4. The card renders **at all fatigue levels** (not only when `shouldSurface` is true) so the user can always see the gauge — green is reassuring, not noise.

## Technical detail

### New file: `src/components/insights/FatigueGauge.tsx`
- Pure SVG component, ~180px wide.
- Props: `frequency: number | null`, `level: FatigueLevel`.
- Maps frequency 0 → 6+ to a 180° arc. Threshold ticks at 2.5, 3.5, 4.5 matching `lib/fatigue.ts`.
- Needle color matches level. Below the needle: large frequency number + "views per person" caption.
- Tooltip on hover explaining the scale.

### Edit: `src/lib/fatigue.ts`
- Add `gaugeAngle(frequency)` helper → returns degrees for the needle (0° at left, 180° at right; map 0 → 0°, 6 → 180°, clamp).
- Add `zoneColors` constant (4 hex/HSL values) for the arc segments.

### Edit: `src/components/insights/CampaignInsightDetail.tsx`
- Replace the existing IIFE block (lines ~579–623) with the new `<FatigueCard>` layout described above.
- Remove the `if (!fatigue.shouldSurface) return null;` early-return so the card always renders.
- Add three action buttons. "Add to bench" dispatches a custom event (`window.dispatchEvent(new CustomEvent('open-bench-picker', { detail: { workspaceId } }))`) — the bench panel further down the page already exists and will listen for it.
- "Bench rules" uses `navigate('/settings?tab=alerts#fatigue')`.

### Edit: `src/components/insights/CreativeBenchPanel.tsx`
- Add a `useEffect` that listens for the `open-bench-picker` event and opens the existing concept picker dialog (`setPickerOpen(true)`).
- No other behavior changes.

### Edit: `src/pages/Settings.tsx`
- Add `id="fatigue"` anchor to the Alert Thresholds card so the deep link from the action button scrolls into view.

### No changes
- No database, edge function, or types changes.
- Thresholds stay in `lib/fatigue.ts` (single source of truth, already used by `InsightsHome` badge).

## Out of scope (will not do)
- Editing per-campaign fatigue thresholds (those live globally in Settings already).
- Wiring the gauge into `InsightsHome` cards — the small Flame badge there is already the at-a-glance signal; the gauge stays on the detail view to avoid clutter.
- Any Meta API changes.
