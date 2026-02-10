

# Simplify Campaign Builder + Results Dashboard Overhaul

## Overview
This plan addresses four major areas: (1) auto-applying best practices in the campaign builder instead of asking users to choose, (2) adding ad-level pause/resume controls with smart recommendations, (3) simplifying the results dashboard to a high-level "traffic light" view with detailed info tucked away, and (4) letting users choose their preferred detail level.

---

## 1. Campaign Builder: Auto-Apply Best Practices

**Current state:** The MobileCampaignBuilder presents 6 steps (Objective, Budget, Creative Type, Audience, Schedule, Review) requiring the user to make choices like audience type, creative type, etc.

**New behavior:**
- Remove the Audience and Creative Type selection steps entirely
- Auto-apply best practices: Broad audience, Advantage+ placements, AEC ON
- Reduce wizard to 3 steps: **Objective, Budget, Review**
- On the Review step, show a card explaining: "We've applied Meta's best practices for you" with a brief list (Broad audience, Advantage+ creative, Advantage+ placements)
- Add a collapsible "Advanced Options" section on the Review step that lets power users see and override: audience type, creative type, warm retargeting, auto-naming
- Social growth campaigns stay at their current reduced step count (skip creative type)

**Files to edit:**
- `src/components/MobileCampaignBuilder.tsx` -- restructure steps, add advanced collapsible

---

## 2. Ad-Level Pause/Resume in Results

**Current state:** The `AdBreakdown` component shows ad-level metrics in a collapsible section but has no controls to pause or resume individual ads.

**New behavior:**
- Add a pause/resume toggle (Switch or button) on each ad row in `AdBreakdown`
- Show a recommendation badge when Lumi has enough data to suggest action:
  - "Enough data" threshold: reach >= 1,000 AND running >= 3 days
  - If CTR < 0.8% after threshold: recommend pausing with a label like "Consider pausing -- low engagement"
  - If performing well (above benchmark): show "Keep running" or "Consider scaling"
  - Before threshold: show "Still learning" with no toggle recommendation
- Toggling calls the existing `build-meta-campaign` or a new lightweight edge function to update ad status via Meta API

**Files to edit:**
- `src/components/insights/AdBreakdown.tsx` -- add toggle + recommendation logic
- May need a new or updated edge function for toggling ad status (can reuse `check-campaign-status` pattern)

---

## 3. Simplify Results Dashboard (InsightsHome + CampaignInsightDetail)

### 3A. InsightsHome (Campaign List View)
**Current state:** Each campaign card shows primary KPI, benchmark, user goal, status badge, progress bars, trend indicators -- quite dense.

**New behavior:**
- Simplify each campaign card to show only:
  - Campaign name + status dot
  - One-line verdict: "Above benchmark", "Right at benchmark", or "Below benchmark"
  - One action recommendation in plain language: "Increase budget", "Refresh creative", or "Consider pausing"
  - A simple on/off toggle to pause/resume the campaign directly from the list
- Remove: benchmark range display, user goal editing, progress bars, trend indicators from the main view
- These details move into the detail view

### 3B. CampaignInsightDetail (Detail View)
**Current state:** Shows 7+ sections: Primary KPI, What's Working, What Needs Attention, Customer Journey, Creative Fatigue, Budget Adjustment, Ad Breakdown, Lumi Recommends.

**New behavior -- High-Level (default):**
- Show 3 simple cards at the top:
  1. **What's Working** -- 1-2 bullet points max
  2. **What's Not Working** -- 1-2 bullet points max  
  3. **What To Do Next** -- one clear action: budget (more/less/same), creative (refresh/keep), or turn off
- Budget recommendation as a simple label: "Increase spend", "Keep spend the same", or "Reduce spend"
- Ad-level pause/resume toggles with recommendations (from section 2)

**New behavior -- Detailed (expandable):**
- Wrap the existing detailed sections (Customer Journey, Creative Fatigue, Budget Adjustment slider, full KPI breakdown) inside a collapsible "Advanced Analysis" accordion
- Users who want depth can expand it; everyone else sees the clean summary

**Files to edit:**
- `src/components/insights/InsightsHome.tsx` -- simplify campaign cards, add pause toggle
- `src/components/insights/CampaignInsightDetail.tsx` -- restructure into high-level summary + collapsible advanced section

---

## 4. User Preference: High-Level vs. Detailed

**New behavior:**
- On first visit to the Results tab, show a small prompt/toggle: "How much detail do you want?" with two options:
  - **"Keep it simple"** -- shows the streamlined high-level view (default)
  - **"Show me everything"** -- auto-expands the advanced sections
- Save this preference to `localStorage` (or `final_answers` on the brand)
- A toggle in the Results header lets users switch between modes anytime

**Files to edit:**
- `src/pages/Data.tsx` -- add preference state + toggle in header
- `src/components/insights/CampaignInsightDetail.tsx` -- respect the preference to auto-expand advanced sections

---

## Technical Details

### Step reduction in MobileCampaignBuilder
- `totalSteps` changes from 6 to 3 (or 2 for social growth since objective is pre-set)
- Default values auto-applied: `audience: "broad"`, `creativeType: "video"`, `warmRetargeting: true`, `metaAdvantage: true`, `placements: "Advantage+"`
- Advanced section uses `Collapsible` from Radix

### Ad toggle edge function
- Create or extend an edge function to call Meta API's `POST /{ad-id}` with `status: "PAUSED"` or `status: "ACTIVE"`
- Requires the brand's `meta_access_token` from the `brands` table

### Recommendation logic thresholds
- "Enough data": impressions >= 1,000 AND campaign age >= 3 days
- Below benchmark: suggest "Refresh creative" or "Consider pausing"
- At benchmark: suggest "Keep spend the same"
- Above benchmark: suggest "Increase spend" or "Scale budget +20%"

### Preference storage
- `localStorage` key: `lumi-insights-detail-level` with values `"simple"` or `"detailed"`

