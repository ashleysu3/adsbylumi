

## Move "Viewing Data" to Above Account Overview & Make It Subtle

### Changes

**`src/pages/Data.tsx`** (lines 725-740):
- Remove the `Card variant="glow"` wrapper around the date range picker entirely

**`src/components/insights/InsightsHome.tsx`** (around line 316):
- Insert the date range picker inline just above the `<AccountOverview>` component
- Style it as a simple flex row with muted text — no card, no border, no glow — just a `Calendar` icon, "Viewing data for:" label, and the `DateRangePicker` dropdown, all in `text-muted-foreground text-sm`

The DateRangePicker props are already passed to InsightsHome, so no new wiring needed.

### Files to edit
- `src/pages/Data.tsx` — remove the date range card from the header
- `src/components/insights/InsightsHome.tsx` — add subtle date range row above AccountOverview

