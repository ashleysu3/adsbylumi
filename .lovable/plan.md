

## Plan: Redesign Creative Studio Header & Tab Bar

### Changes

#### 1. Restructure the toolbar — everything inside `max-w-6xl` container
- Move the toolbar (campaign selector + Creative Brief + primary action) **inside** the `max-w-6xl mx-auto` container so it aligns with the tab bar and content below
- Campaign label stacked above dropdown (already done), but now aligned with the content grid

#### 2. Redesign the tab bar with Lumi brand colors
- Each tab gets its own brand color from the gradient palette:
  - **Angles** → Orange (`lumi-orange-1`)
  - **Creative Concepts** → Pink (`lumi-pink-1`)
  - **Ad Copy** → Purple (`lumi-purple-1`)
  - **Creation** → Blue (`lumi-blue-1`)
- Active tab: filled background with its color, white text
- Inactive tabs: subtle tinted background (`color/10`), colored text
- Remove the generic `bg-muted` container — use a transparent or very light container with individual colored pills
- Add a subtle bottom border or underline accent on the active tab
- Slightly larger tab height (`h-12`) with better padding for a more designed feel

#### 3. Polish spacing & alignment
- Remove the outer margin spacing before the `max-w-6xl` container
- Everything flows inside one consistent content column
- Toolbar row: campaign dropdown left, Creative Brief + primary action right, all on one line

### Files Modified
- `src/pages/CreativeStudio.tsx` — restructure toolbar position, restyle tab triggers with per-tab brand colors (~30 lines changed)

