

# B-Roll Library + Auto-Preview in Production Checklist

## Overview

Instead of a separate "assembler" tool, this integrates b-roll management directly into the existing flow:

1. **My Brand Dashboard** gets a new "B-Roll Library" section where users bulk-upload their everyday b-roll clips (plus choose their preferred overlay font and colors)
2. **Production Checklist** automatically pairs b-roll concepts with clips from the library, shows a live text-overlay preview, and lets the user fine-tune before marking as ready

## User Flow

1. **Brand Dashboard** — User uploads 20-30 short clips (pouring coffee, typing, walking the dog, etc.) and picks a font + text color + background style for overlays
2. **Creative Studio generates b-roll concepts** — Each has `text_overlays` with timing, text, and type (hook/insight/cta)
3. **Production Checklist** — When a b-roll concept appears, Lumi auto-selects a clip from the library (random or round-robin) and renders a live CSS preview of the text overlays on top of the video
4. **Fine-tune** — User can swap the clip, adjust text position, or tweak colors per-concept before marking ready

## Database Changes

**Migration: Add columns to `brands` table**

```sql
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS broll_library jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS overlay_style jsonb DEFAULT '{"fontFamily": "Inter", "fontSize": 32, "textColor": "#FFFFFF", "bgColor": "#000000", "bgOpacity": 0.6, "position": "bottom", "textShadow": true}'::jsonb;
```

- `broll_library`: array of `{ id, file_name, file_url, storage_path, duration_hint?, tags?, uploaded_at }`
- `overlay_style`: `{ fontFamily, fontSize, textColor, bgColor, bgOpacity, position, textShadow }`

No new tables needed — keeps it simple.

## File Changes

### 1. New: `src/components/BRollLibrary.tsx`
Brand Dashboard section for managing the b-roll clip library:
- Bulk upload zone (video only, under 30s each, 250MB limit)
- Grid of uploaded clips with thumbnail previews and delete
- Optional tags per clip (e.g., "morning routine", "desk", "outdoors")
- Count badge showing how many clips uploaded

### 2. New: `src/components/OverlayStylePicker.tsx`
Compact style config card shown below the B-Roll Library:
- Font family selector (6-8 options: Inter, Playfair Display, Montserrat, Bebas Neue, etc.)
- Text color picker
- Background color + opacity slider
- Position selector (top / center / bottom)
- Text shadow toggle
- Live preview strip showing sample text with chosen styles

### 3. Modified: `src/pages/Dashboard.tsx`
- Import and render `BRollLibrary` and `OverlayStylePicker` as a new card section after the Emoji Preferences card
- Pass `brand.id`, `brand.broll_library`, and `brand.overlay_style` as props
- Handle updates (save to brands table)

### 4. New: `src/components/VideoTextPreview.tsx`
Reusable component that renders a `<video>` element with CSS-positioned text overlays synced to `currentTime`:
- Takes: video URL, `TextOverlay[]`, `OverlayStyle`, and optional override props
- Uses `timeupdate` event to show/hide overlay text based on timing strings like `"0-3s"`
- Purely CSS — no canvas rendering needed for preview

### 5. Modified: `src/components/ProductionChecklist.tsx`
For b-roll format items:
- Auto-select a clip from `brand.broll_library` (round-robin to avoid repeats)
- Show `VideoTextPreview` inline with the concept's `text_overlays` and `brand.overlay_style`
- Add a "Swap Clip" dropdown to pick a different clip from the library
- Add per-concept position override (top/center/bottom) if user wants to adjust
- If no clips in library, show a prompt: "Upload b-roll clips in My Brand to see previews here"

### 6. Modified: `src/components/ProductionWorkflow.tsx`
For b-roll items entering the production workflow:
- Pre-populate the "create" step with the matched clip + overlay preview
- Allow the user to confirm or swap before moving to upload
- The matched clip from the library can be directly used as the uploaded asset (skip re-upload)

## File Summary

| File | Change |
|------|--------|
| `src/components/BRollLibrary.tsx` | **New** — bulk upload + manage b-roll clips on brand |
| `src/components/OverlayStylePicker.tsx` | **New** — font, color, position picker for text overlays |
| `src/components/VideoTextPreview.tsx` | **New** — video player with timed CSS text overlays |
| `src/pages/Dashboard.tsx` | Add B-Roll Library + Overlay Style sections |
| `src/components/ProductionChecklist.tsx` | Auto-match clips to b-roll concepts, show preview |
| `src/components/ProductionWorkflow.tsx` | Pre-populate b-roll items with matched clip |
| Migration | Add `broll_library` and `overlay_style` columns to `brands` |

## Technical Notes
- All previews are CSS-only (absolute-positioned text over `<video>`) — no canvas or server processing
- Clips are stored in Supabase Storage under a `broll-library/{brand_id}/` path
- The overlay style is saved once at brand level but can be overridden per-concept in the production checklist
- No edge function changes needed — this is entirely client-side

