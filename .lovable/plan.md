

## Plan: Improve Creative Studio Toolbar UX

### Changes

#### 1. Move AutoSaveIndicator to bottom-right corner
- Float it as a small fixed/absolute element in the bottom-right of the studio area (like a status bar indicator)
- Remove it from the toolbar row where it feels out of place

#### 2. Add a label next to the campaign dropdown
- Add a small `"Campaign:"` label or subtle text before the `<Select>` so users understand what the dropdown controls
- Style it as muted text, e.g. `text-xs text-muted-foreground font-medium`

### Files Modified
- `src/pages/CreativeStudio.tsx` — move AutoSaveIndicator, add dropdown label (~5 lines changed)

