# Creative generator pop-up: UX redesign

Goal: turn the "Generate this creative (beta)" dialog into a calm, three-step flow with a live preview always in view. All generation logic, edge function calls, brief handling, and rendering stay exactly as they are — this is a layout and interaction change only.

## Problems being fixed

- Six stacked bands of chrome (title, beta banner, brand-kit swatches, step chips, tour button, mode link, brief card) before the first real control.
- Two competing mental models: Template has 2 steps, Remix has none, and the step chips only render in Template mode.
- Step 2 is one long scroll: image source, copy editor, render button, and a large color/size/case tweak panel all at equal weight.
- No preview while editing — you edit copy blind, render, scroll down to results, scroll back up to tweak.
- Developer language leaks into the UI ("Will be sent as `backgroundUrl` to the renderer", raw slot keys as labels).

## New structure

```text
┌──────────────────────────────────────────────────────────────┐
│ Generate this creative   Beta · Brand kit: Holly ▪▪▪▪        │
│ ① Style ——— ② Image & copy ——— ③ Render        [Show me how] │
├───────────────────────────────┬──────────────────────────────┤
│ LEFT: step content (scrolls)   │ RIGHT: live preview (sticky) │
│                                │  ┌────────────────┐         │
│  brief summary (compact)       │  │                │         │
│  step controls                 │  │   1:1 / 9:16   │         │
│                                │  │                │         │
│                                │  └────────────────┘         │
│                                │  ▸ Refine (collapsed)       │
├───────────────────────────────┴──────────────────────────────┤
│ [Back]                                   [Primary action →]  │
└──────────────────────────────────────────────────────────────┘
```

### Step 1 — Style
Two large choice cards instead of the tiny "Remix a real ad instead" link:
- **Use a template** — pick from built-in + custom templates (existing template grid).
- **Remix a real ad** — pick a board image (existing board/image picker).

Choosing a card sets `mode` and reveals that mode's picker inline. Continue advances to step 2.

### Step 2 — Image & copy
- Image source block first (uploads / brand library tabs, unchanged logic), with plain-English helper text replacing the `backgroundUrl` note.
- Copy block second: option tabs and per-slide fields as today, but slot labels run through the friendly-label map, and empty slots read "Add {label}" instead of a blank box.
- Every keystroke updates the right-hand preview.

### Step 3 — Render & results
- Primary "Render" action; results grid stays where it is today.
- All styling controls (colors, text case, headline/body size, text color, text background) move into a **Refine** accordion under the preview, closed by default, auto-opened after the first successful render.

### Header cleanup
- Beta banner + brand-kit swatch row condense to one line in the header: `Beta · Brand kit: <name> <swatches>`, with the swatch tooltip and "switch brands in the sidebar" hint preserved as a tooltip.
- Step rail replaces the ad-hoc chips and renders identically in both modes.
- Brief card becomes a single compact line with badges, expandable to show key message / offer.

## Technical notes

- File: `src/components/creative/GenerateCreativeDialog.tsx` (currently 2282 lines). The redesign is a good moment to extract presentational pieces without touching logic:
  - `StyleStep.tsx` — mode cards + template grid + board picker.
  - `ImageCopyStep.tsx` — image source + copy editors (`SingleEditor` / `CarouselEditor` move here).
  - `PreviewPane.tsx` — sticky preview + Refine accordion + results.
  - Parent keeps all state, effects, `compose()`, `generate()`, `runAnalysis()`, brief handling unchanged.
- `step` state becomes `"style" | "image-copy" | "render"`; Remix mode now uses the same three steps (its step 1 is the board picker).
- Live preview reuses the existing render-preview markup; it renders from `editedSingle` / `editedSlides` + `selectedPhoto` + current style overrides, so no new backend calls.
- `dialogTourSteps` gets a third branch for the render step; existing `data-help-target` attributes are carried over to the new components.
- Dialog grows to `max-w-6xl` with a `md:grid-cols-[minmax(0,1fr)_360px]` body; on small screens the preview stacks above the controls.
- Guardrails: no changes to `compose-ad`, `customSlots`/`customType` payloads, slide-count enforcement, or the `canRender` / `copyReady` gating rules.
