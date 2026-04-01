

# Dual-Format Upload Flow: Square + Vertical Asset Prompting

## Summary
Update the creative asset upload UX to **actively prompt** users to upload both a square (1:1) and story-sized (9:16) version for graphics, while enforcing video as 9:16 only. Add a clear fallback message: if they skip the vertical version, Lumi will auto-extend with color bars (matching Meta's default behavior).

## What Changes

### 1. CreativeChecklistCard — Redesign the upload section
**Current**: After uploading a square image, a subtle ghost button says "Add 9:16 version for Stories / Reels (optional)".
**New**:
- After uploading a square image, show a **prominent amber/blue info card** prompting the 9:16 upload — not just a ghost button
- Card text: "Upload a 9:16 version for Stories & Reels" with subtitle "If you skip this, Lumi will auto-extend your square with color bars — just like Meta does."
- For **videos**: after upload, show "Video uploaded (9:16 — Stories & Reels ready)" with no vertical prompt (since video is already 9:16-only)
- Update the initial upload button label for images: "Upload Square (1:1) Version" instead of generic "Upload"

### 2. CreativeChecklistCard — Add format guidance badges
- For image items: show a small info tooltip or inline text: "Images: upload square (1080×1080) first, then add a 9:16 version"
- For video items: show "Videos: 9:16 vertical only"

### 3. ProductionManager — Auto-extend fallback logic notation
- When building the campaign (no code change to Meta build needed), if a square image has no `_vertical` asset, add a metadata flag `auto_extend: true` to signal downstream that Meta's default color-bar behavior will apply
- Update the toast/status to inform users: "No 9:16 version — Meta will auto-extend with color bars"

### 4. BYOCreativeUploader — Add format guidance to the upload step
- Below the drop zone, add a concise format guide card:
  - **Images**: "Upload your square (1:1) version first. You'll be prompted to add a 9:16 Stories version next."
  - **Videos**: "9:16 vertical format only."
- This sets expectations before users even start uploading

### 5. AssetUploader — Update recommended formats section
- Update the "Recommended Formats" card to explicitly mention the dual-upload flow for images

## Files to Modify
1. `src/components/creative/CreativeChecklistCard.tsx` — Redesign post-upload section with prominent 9:16 prompt and fallback messaging
2. `src/components/creative/ProductionManager.tsx` — Add auto-extend flag when no vertical version exists
3. `src/components/creative/BYOCreativeUploader.tsx` — Add format guidance below drop zone
4. `src/components/AssetUploader.tsx` — Update recommended formats copy

## Technical Notes
- No database schema changes needed — the `_vertical` suffix convention and `is_vertical_version` flag already exist
- The `auto_extend` flag is informational only; Meta handles the actual color-bar extension server-side
- Video 9:16 enforcement already exists via `validateVideoAspectRatio`

