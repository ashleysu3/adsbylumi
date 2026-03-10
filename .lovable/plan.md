

## Plan: Show Top 3 KPIs with Goals and Color-Coded Status on Campaign Cards

### Current State
Each campaign card in the Ad Performance page shows a single status dot and a verdict ("Above benchmark" / "Below benchmark") based on the primary KPI. The actual KPI values are shown as small pills without color coding. Goals are shown in a separate row for only the primary KPI.

### What We'll Build
Replace the current verdict row and objective-metric pills with a clear **KPI summary strip** showing the top 3 KPIs per campaign, each with:
- KPI label (e.g., "CPL", "CTR", "Frequency")
- Actual value from the selected date range
- Goal/benchmark threshold
- Green / Yellow / Red background coloring based on performance vs goal

### Implementation

**1. Create `CampaignKPISummary` component** (`src/components/insights/CampaignKPISummary.tsx`)
- Accepts campaign metrics, campaign_goals data (from DB), and the kpiConfig
- Determines top 3 KPIs: primary KPI from goals → secondary KPI from goals → fallback to CTR or Frequency from kpiConfig
- For each KPI, evaluates status using `getLumiKPIStatus` logic (green = healthy, yellow/amber = attention, red = critical)
- Renders 3 compact KPI cells in a row, each color-coded

**2. Fetch campaign_goals in InsightsHome** (`src/components/insights/InsightsHome.tsx`)
- On mount, batch-fetch `campaign_goals` for all visible campaign workspace IDs
- Store in a `goalsMap: Record<workspaceId, GoalData>` 
- Pass each campaign's goals into the new `CampaignKPISummary` component

**3. Update campaign card layout** (`src/components/insights/InsightsHome.tsx`)
- Replace the current Row 2 objective-metric pills and Row 3 verdict with the new KPI summary strip
- Keep spend and daily budget as a subtle line above the KPIs
- Remove the existing `CampaignGoalRow` since goals are now integrated into the KPI summary
- Keep the status dot on the campaign name row (derived from primary KPI status)

### KPI Priority Logic
```
1. Primary KPI from campaign_goals table (user-configured)
2. Secondary KPI from campaign_goals table (user-configured)  
3. Fallback: CTR or Frequency (whichever is most actionable)
```

### Color Logic per KPI
- **Green**: Value meets or beats goal/benchmark
- **Yellow/Amber**: Within 20-30% of goal threshold
- **Red**: Significantly missing goal

Uses existing `getLumiKPIStatus` for benchmark-based evaluation, and goal-based evaluation for user-set thresholds from `campaign_goals`.

### Files to Create/Edit
- **Create**: `src/components/insights/CampaignKPISummary.tsx`
- **Edit**: `src/components/insights/InsightsHome.tsx` — fetch goals, replace metric pills + verdict with KPI summary

