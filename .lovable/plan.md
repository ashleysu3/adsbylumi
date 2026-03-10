

## Plan: Fix Conflicting Campaign Detail View

### Problems

1. **"What's Not Working" shows irrelevant KPIs** (e.g., CPM) — The `needsAttention` array pulls from `analysis.kpi_evaluation` without filtering by the campaign's objective. CPM being flagged on a lead gen campaign is noise.

2. **"Everything looks great!" above red cards** — When `needsAttention` is empty (no KPIs flagged in the analysis), the card says "Everything looks great! 🎉" while the Budget Recommendation card below says "Reduce spend" in red, and the primary KPI card is also red. The analysis KPI evaluation and the local `getLumiKPIStatus` logic are evaluating different data, creating contradictions.

3. **"What To Do Next" is vague/alarming** — It shows "X actionable recommendations — tap to view" without saying what the recommendations are. Just a number with no context.

4. **Ad-Level Breakdown shows wrong metrics** — `AdBreakdown` hardcodes Spend/Clicks/CTR/CPC for every campaign regardless of objective. A Sales campaign should show ROAS; a Lead Gen campaign should show CPL.

### Implementation

**File: `src/components/insights/CampaignInsightDetail.tsx`**

1. **Filter "What's Not Working" by objective relevance**: Use the campaign's `kpiConfig` to only show KPI evaluations for the primary and secondary KPIs. Ignore evaluations for irrelevant metrics (like CPM on a lead gen campaign).

2. **Align "Everything looks great" with actual status**: Instead of only checking `needsAttention.length`, also check the local `status` variable. If `status` is `critical` or `attention`, don't show "Everything looks great" — show the primary KPI concern instead.

3. **Make "What To Do Next" show actual first step**: Replace the generic "X recommendations — tap to view" with the first concrete recommendation text (truncated). Give users a reason to tap.

4. **Pass campaign objective to AdBreakdown**: Add an `objective` and `primaryKPI` prop so AdBreakdown can show the right metrics.

**File: `src/components/insights/AdBreakdown.tsx`**

5. **Dynamic metrics grid based on objective**: Accept `objective`/`primaryKPI` props. Map campaign type to the 4 most relevant ad-level metrics. E.g.:
   - Lead Gen: Spend, Leads, CPL, CTR
   - Sales: Spend, Purchases, ROAS, CPC
   - Traffic: Spend, Link Clicks, CPC, CTR
   - Default fallback: Spend, Clicks, CTR, CPC (current behavior)

6. **Fix ad recommendation logic**: `getAdRecommendation` currently only checks CTR/ROAS. Should check the campaign's primary KPI instead.

### Key Changes

```text
CampaignInsightDetail:
  - needsAttention: filter by kpiConfig.primary/secondary relevance
  - "Everything looks great": gate on local status !== 'critical'/'attention'
  - "What To Do Next": show first recommendation text inline

AdBreakdown:
  - New props: objective, primaryKPI
  - Metrics grid: dynamically select 4 columns based on objective
  - getAdRecommendation: check primary KPI, not just CTR
```

