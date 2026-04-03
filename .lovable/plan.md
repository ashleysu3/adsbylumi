

# Copy Picker for BYO Uploads — Cherry-Pick from Existing Angle Copy

## Problem
When uploading your own creative, the only copy options are "Lumi writes copy" or "I'll add my own." But often there's already great copy generated across other angles that you'd love to reuse. There's no way to browse and cherry-pick from it.

## Solution
Add a third option on the copy choice screen: **"Pick from existing copy"** — opens a browsable list of all copy already generated across every angle, letting you check off your favorites to pair with uploaded creative.

## How It Works

1. **Copy choice screen** gets a third card: "Pick from my existing copy" with a library icon
2. Clicking it opens a new `pick_copy` step showing all angle copy organized by type (Headlines → Descriptions → Primary Copy)
3. Each variation is a selectable card showing the text, which angle it came from, and character count
4. User checks their favorites, clicks "Use Selected Copy" → those get attached to the BYO angle as its `angle_copy`

## Changes

### 1. `src/components/creative/BYOCreativeUploader.tsx`
- Add `angleCopy` prop (the existing `Record<string, AngleCopy>` from CreativeStudio state)
- Add `angles` prop (for angle name labels)
- Add new step `"pick_copy"` to the Step type
- Add third button on copy_choice screen: "Pick from my existing copy" (only shown when angleCopy has content)
- Build the pick_copy step UI:
  - Three sections: Headlines, Descriptions, Primary Copy
  - Each card shows: text, source angle name badge, char count, checkbox
  - "Use Selected" button at bottom assembles a new AngleCopy object for the `byo_uploads` angle
  - Calls `onComplete` with a new `"picked"` copy choice that includes the selected copy

### 2. `src/pages/CreativeStudio.tsx`
- Pass `angleCopy` and `availableAngles` to `BYOCreativeUploader`
- Handle the new `"picked"` copy choice in `onComplete` — merge the selected copy into the workspace's `angle_copy` under the `byo_uploads` key

## Files

| File | Change |
|------|--------|
| `src/components/creative/BYOCreativeUploader.tsx` | Add angleCopy/angles props, pick_copy step with browsable copy picker |
| `src/pages/CreativeStudio.tsx` | Pass angleCopy + angles props, handle picked copy in onComplete |

