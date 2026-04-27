## Goal

Three improvements to the b-roll text overlay editor and Style page:

1. Move the "Edit mode" badge out from over the video.
2. Show greyed-out Instagram chrome blockers (top + bottom) so users know what areas get covered by IG profile/caption.
3. Let users set a default text position (and font scale) once on the Style page — it auto-applies to every b-roll, but per-clip drag/resize still wins.

---

## 1. Move "EDIT MODE" badge to the side

In `src/components/VideoTextPreview.tsx`:

- Remove the absolutely-positioned `Edit mode · all overlays shown` badge currently sitting at `top-2 left-2` over the video (lines 642–647).
- Remove the bottom hint strip currently overlaid on the video (lines 650–654).
- Render both pieces of UI **outside** the video frame instead. Wrap the existing `<div ref={containerRef} ...>` in a fragment + a thin sidebar/footer:
  - To the **right** of the video on `md+` screens (and **below** on mobile), show a small vertical caption: a colored dot + "Edit mode — all overlays shown" + the hint text ("Drag text to move · hover for handles to resize · press play to preview real timing").
  - Use muted foreground colors so it reads as chrome, not as part of the video.
- Keep the per-overlay numbered chip (1, 2, 3…) on each overlay — that's the only on-video edit indicator left.

Because consumers (`BRollTextEditor`, `CreativeChecklistCard`, `StylePreviewPanel`) already wrap `VideoTextPreview` in their own layout, moving the chrome from inside the `aspect-[9/16]` container to a sibling element is safe — no parent layout breakage.

---

## 2. Instagram safe-zone blockers (top 1/5 + bottom 1/5)

In `src/components/VideoTextPreview.tsx`, inside the video container, add two new absolutely-positioned overlays that **only render when `editable && !isPlaying`** (i.e. edit mode):

- Top band: `absolute top-0 left-0 right-0 h-[20%]`, semi-transparent dark wash with diagonal stripes, label "IG profile / username area".
- Bottom band: `absolute bottom-0 left-0 right-0 h-[20%]`, same treatment, label "IG caption / actions area".
- Both `pointer-events-none`, `z-25` (above text overlays so the warning is visible, but below the resize handles so dragging still works — actually safer to put them at `z-5` **below** overlays so the user can still drag text into the danger zone, but the wash makes it visually obvious. Pick z-5 so overlays render on top.)
- Use a subtle warning color (e.g. `bg-amber-500/15` with a 1px dashed `border-amber-400/40` on the inner edge) and a small label badge in the corner of each band.
- These bands disappear during playback so the preview stays clean.

This is a purely visual aid — does not affect `xy` math or the rendered MP4.

---

## 3. Brand-level default text position + scale on the Style page

### 3a. Extend the saved overlay style

`OverlayStyle` (in `src/components/VideoTextPreview.tsx`) already has `position: "top" | "center" | "bottom"`. Extend it with:

- `defaultXY?: OverlayXY` — fine-grained 0–1 coordinates for the default text center.
- `defaultScale?: number` — default font-size multiplier (matches per-overlay `scale`).

Update `DEFAULT_OVERLAY_STYLE` to include `defaultXY: { x: 0.5, y: 0.78 }` (inside the safe zone, between the two IG bands) and `defaultScale: 1`.

Update `defaultXYFromPosition()` so callers can also pass the full `OverlayStyle` and prefer `style.defaultXY` when present, falling back to the top/center/bottom mapping. Add a helper `resolveDefaultXY(style: OverlayStyle): OverlayXY`. Mirror the same change in `src/lib/ffmpeg-renderer.ts` (its local `defaultXYFromPosition` + the line at `src/lib/ffmpeg-renderer.ts:253` that resolves overlay xy).

### 3b. Auto-apply to every overlay

In `VideoTextPreview` and the renderer, the existing logic is `overlay.xy ?? defaultXYFromPosition(style.position)`. Change to `overlay.xy ?? resolveDefaultXY(style)`. Same for `overlay.scale ?? (style.defaultScale ?? 1)`.

Result: any overlay without a per-clip override automatically uses the brand default. Per-clip drag/resize still writes `xy`/`scale` on the individual overlay, which always wins.

### 3c. New "Default text position" editor on the Style page

In `src/components/OverlayStylePicker.tsx`, replace the current 3-button Top/Center/Bottom selector with a richer block:

- Keep a quick "Top / Center / Bottom" preset row — clicking sets both `position` and `defaultXY` to the corresponding preset coords.
- Below that, render a **small interactive 9:16 stage** (~140×250px) with a placeholder b-roll image (or just a gradient) and a draggable "AA" sample text token. Dragging the token updates `defaultXY`. Show the same IG safe-zone bands as visual guides.
- Add a "Default text size" slider (0.5×–2.0×) that updates `defaultScale`. Show a live numeric readout.
- Add a "Reset to bottom" link.

The mini-stage is its own small component (`DefaultTextPositionEditor`) inside `OverlayStylePicker.tsx` — uses the same pointer-event math as `VideoTextPreview` (clamp01) but operates on its own ref'd box.

### 3d. Style preview panel reflects the default

Update `src/components/StylePreviewPanel.tsx` so the mocked overlay sits at `defaultXY` (percent-based `left`/`top` with translate -50%/-50%) and uses `defaultScale`, replacing the current `top-4 / top-1/2 / bottom-4` class switching. So users see exactly where their overlay will land.

### 3e. Persistence

`brands.overlay_style` is a JSONB column already saved by `Style.tsx`. The new `defaultXY` + `defaultScale` keys piggyback on the existing save call — no DB migration needed (per the existing OverlayStylePicker comment at lines 16–18).

### 3f. BRollTextEditor preview alignment

`BRollTextEditor` already passes `effectiveStyle` to `VideoTextPreview`. Once `resolveDefaultXY` honors `style.defaultXY`, every new overlay added in the editor (e.g. the seed `'Your hook here'` overlay) will start at the brand default automatically — no change needed there beyond what step 3b covers. The "reset to default position" link (line 290–295) already does the right thing because it clears `xy`, falling through to the brand default.

---

## Files touched

- `src/components/VideoTextPreview.tsx` — move badge/hint outside frame, add IG safe-zone bands, extend `OverlayStyle` type, add `resolveDefaultXY`.
- `src/lib/ffmpeg-renderer.ts` — mirror `resolveDefaultXY` so renderer respects brand default.
- `src/components/OverlayStylePicker.tsx` — new `DefaultTextPositionEditor` mini-stage + scale slider.
- `src/components/StylePreviewPanel.tsx` — render preview overlay at `defaultXY` / `defaultScale`.
- (No DB migration; no edge-function change.)

## Out of scope

- No changes to the Instagram bands during actual MP4 render — they're editor-only guides.
- No new fields on `OverlayStyle` beyond `defaultXY` and `defaultScale`.
- No change to per-overlay drag/resize behavior — still wins over the brand default.
