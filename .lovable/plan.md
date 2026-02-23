

# Results Dashboard Enhancements: Labels, KPIs, and Actionable Budget Recommendations

## What Changes

### 1. Toggle Label
Add a visible "Live" / "Paused" label next to the campaign on/off toggle so it's clear what it controls.

### 2. Key Metrics on Each Campaign Card
Show objective-specific KPIs directly on each campaign card:

- **All campaigns**: Daily budget, total spend for the period
- **Lead campaigns**: Number of leads + Cost Per Lead (CPL)
- **Purchase/Sales campaigns**: Number of purchases, ROAS, Cost Per Purchase, conversion value
- **Traffic campaigns**: Link clicks + Cost Per Click (CPC)
- **Video campaigns**: ThruPlays + Cost Per ThruPlay
- **Engagement/Awareness**: Impressions + CPM

### 3. Clickable Recommendation Badge
The action recommendation badge (e.g., "Increase budget") becomes clickable. Clicking it opens a popover with the BudgetAdjustmentPanel inline, so users can immediately apply the recommended budget change without navigating away.

---

## Technical Details

### Files to Modify

**`src/pages/Data.tsx`** (lines ~280-350)
- Add `campaign_builder_answers` to the select query when fetching campaign workspaces
- Pass `dailyBudget` (extracted from `campaign_builder_answers.budget`) into each `CampaignData` object

**`src/components/insights/InsightsHome.tsx`**
- Update `Campaign` interface to include `dailyBudget?: number`
- Add a metrics row between the campaign name and verdict rows showing:
  - Daily budget pill: "$XX/day"
  - Total spend pill: "$XX spent"
  - Objective-specific KPIs (e.g., "12 Leads | $8.50 CPL" or "6 Purchases | 3.2x ROAS | $42 CPP")
- Add "Live" / "Paused" label text next to the Switch toggle
- Replace the static `Badge` for action recommendation with a `Popover` trigger that opens the `BudgetAdjustmentPanel` when clicked (for "Increase budget" and "Keep spend the same" actions); for "Refresh creative or pause" it links to the campaign detail view instead

**`src/lib/lumi-kpi-config.ts`**
- Add a new helper function `getObjectiveMetrics(metrics, kpiConfig)` that returns an array of formatted label+value pairs based on the campaign objective (e.g., for leads: `[{label: "Leads", value: "12"}, {label: "CPL", value: "$8.50"}]`)

### New Imports in InsightsHome
- `Popover`, `PopoverTrigger`, `PopoverContent` from UI components
- `BudgetAdjustmentPanel` from insights components

### Campaign Card Layout (Updated)

```text
+--------------------------------------------------+
| [dot] Campaign Name              Live [toggle]   |
|                                                   |
|      $25/day  |  $175 spent  |  12 Leads  $8 CPL |
|                                                   |
|      Above benchmark        [Increase budget v]   |
|                                                   |
|      [View Details]  [Link Offer]                 |
+--------------------------------------------------+
```

When user clicks "Increase budget" badge, a popover opens with the full BudgetAdjustmentPanel showing the Lumi recommendation, slider, and save button.

### Data Flow
1. `Data.tsx` fetches `campaign_builder_answers` from `campaign_workspaces`
2. Extracts `budget` field and passes as `dailyBudget` on each campaign
3. `InsightsHome` receives campaigns with budget + metrics and renders the enhanced cards
4. Clicking the recommendation badge opens BudgetAdjustmentPanel in a popover, scoped to that campaign

