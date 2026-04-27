# Fix Text Overlay Timing + Add Hook/CTA Emphasis

## Problem

Two issues with the current b-roll text overlay system:

1. **All overlays stack on top of each other** when the video is paused (visible in your screenshot with all 6 lines showing at once). They should appear one at a time, respecting the timing range next to each phrase (`0-3s`, `4-7s`, `8-11s`, etc.)
2. **No way to make Hook and CTA stand out** — they currently render identically to insight/transition lines.

## What changes

### 1. Timing fix — one overlay at a time

In the preview (`VideoTextPreview.tsx`), an overlay only shows when the playhead is inside its window. When paused, show only the overlay matching the current frame (or the first one if the video hasn't started). No more stacking.

### 2. Emphasis system for Hook + CTA

Add three new fields to the brand-level Overlay Style settings (under Brand Style → Text Overlay Style):

- **Emphasize Hook & CTA** (toggle, default ON)
- **Emphasis size boost** (slider, +20% to +80%, default +30%) — applied to the hook/cta `fontSize`
- **Emphasis style** (dropdown: `Bold only`, `ALL CAPS`, `Bold + ALL CAPS`, default `Bold + ALL CAPS`)

These apply automatically based on each overlay's existing `type` field (`hook`, `insight`, `transition`, `cta`) — already populated by the AI when the script is generated. The user doesn't tag anything manually.

The same emphasis logic applies in three places so preview and final render match:
- Live `VideoTextPreview` (in CreativeChecklistCard + BRollTextEditor)
- Burned MP4 via `ffmpeg-renderer.ts` (canvas text rendering)
- The brand Style page live preview

### 3. Settings location

Lives in **Brand Style → Text Overlay Style** card (`OverlayStylePicker.tsx`), persisted on `brands.overlay_style` (existing JSONB column). No DB migration needed — the new fields are just extra keys in the same JSON blob.

## Files touched

- `src/components/VideoTextPreview.tsx` — fix timing logic, apply emphasis
- `src/components/OverlayStylePicker.tsx` — add the 3 emphasis controls
- `src/lib/ffmpeg-renderer.ts` — accept per-overlay `type`, apply emphasis when burning text
- `src/contexts/RenderQueueContext.tsx` — pass `type` through to renderer
- `src/components/creative/CreativeChecklistCard.tsx` + `src/components/BRollTextEditor.tsx` — pass `type` into RenderOverlay specs
- `src/components/VideoTextPreview.tsx` `OverlayStyle` interface — add `emphasizeHookCta`, `emphasisBoost`, `emphasisStyle`

No database migration. No breaking changes to existing brands (defaults applied when fields are missing).

## Out of scope

- Per-overlay manual styling (one-off tweaks to a single line)
- Animation/fade effects between overlays (current behavior stays: instant in/out)
- Changing the AI-assigned `type` from the UI