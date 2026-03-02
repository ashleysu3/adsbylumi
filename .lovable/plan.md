

## Plan: Clean Up Creative Studio

### Problem
The Creative Studio toolbar is crowded with a workspace dropdown, Creative Brief button, and primary action all competing for space. The dropdown currently pulls from workspaces with strategies — it should pull from "My Campaigns" (campaign_workspaces) and not offer a way to create new campaigns from here.

### Changes

#### 1. Simplify the toolbar header (lines ~916-950)
- Remove the back arrow button (sidebar handles navigation now)
- Remove "Creative Studio" title + brand name (redundant with sidebar)
- Keep only: **AutoSaveIndicator** | **Campaign dropdown** | **Creative Brief** | **Primary Action**
- Make the dropdown cleaner — show offer name with a subtle campaign name fallback, no `FolderOpen` icon clutter

#### 2. Workspace dropdown: pull from My Campaigns only
- Currently filters `campaign_workspaces` where `strategy_json IS NOT NULL` — keep this filter (campaigns without strategy can't use the studio)
- Remove `archived` campaigns from the dropdown
- Remove any "new campaign" affordance from this page — the empty state already directs to `/create`

#### 3. Simplify the tab bar (lines ~955-974)
- Remove the numbered circles (1, 2, 3, 4) — they add clutter
- Keep: icon + label + green checkmark for completion
- Reduce visual weight: smaller rounded corners, less gradient intensity on active state

#### 4. Remove the idle help popup (lines ~1219-1272)
- The floating "Need help?" popup after 45s is noisy and rarely useful
- Remove the entire idle timer system (~25 lines of state + useEffect + JSX)
- The LumiAssistant floating widget already provides on-demand help

#### 5. Tighten concept cards (lines ~1039-1090)
- Currently 3-column grid with generous padding — keep layout but reduce card padding slightly
- No functional changes, just tighter spacing

### Files Modified
- `src/pages/CreativeStudio.tsx` — all changes in one file (~60 lines removed, ~15 lines modified)

### Summary of What's Removed
- Back arrow button (sidebar exists)
- "Creative Studio" / brand name header text
- Numbered step circles in tabs
- 45-second idle help popup system
- `FolderOpen` icon from dropdown

### What's Kept (no feature loss)
- Campaign dropdown (filtered, no archived)
- All 4 workflow tabs with completion checkmarks
- Creative Brief button
- Context-aware primary action button
- Auto-save indicator
- Mobile floating action
- All generation, regeneration, and context dialogs
- Smart resume / tab persistence

