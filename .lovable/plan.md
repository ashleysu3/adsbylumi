

# Simplified Creative Brief + Data-Informed Creative Strategy

## Overview

Two connected features for Creative Studio:

1. **"Creative Brief" mode** -- a simplified, handoff-ready production sheet per angle with graphic copy, instructions, and format-specific direction that a creative team can execute without needing app access.

2. **Smart Creative Strategy** -- before generating angles, the system checks the brand's Meta ad account for the last 60-90 days of performance data. If data exists, it analyzes which ads drove the best results (sales, leads, etc. based on campaign objective) and feeds those learnings into the creative generation. If no data exists, it defaults to best-practices testing across creative types.

---

## Part 1: Creative Brief Export (Handoff Sheet)

### What it produces

A clean, per-angle production brief document (CSV/printable) designed for a creative team or freelancer. Each row is one creative asset with:

| Column | Description |
|--------|-------------|
| Asset # | Sequential number |
| Angle | Which angle this belongs to |
| Format | Talking Head, Graphic, B-Roll |
| Hook | The opening line or headline |
| Graphic Copy | Exact text to place on the graphic (text overlays, written hooks) |
| Script | Full script if talking head |
| Visual Direction | What to film or design |
| Ad Copy | Headline, primary text, CTA |
| Notes | Psychology notes simplified into "why this will work" |

### Technical changes

**File: `src/lib/export-production-checklist.ts`**
- Add a new `generateCreativeBriefCSV()` function that produces a cleaner, team-friendly format
- Consolidate text overlays into a single "Graphic Copy" column with clear placement instructions
- Add a "Production Instructions" column with simplified, actionable steps (not psychology jargon)

**File: `src/components/creative/ExportChecklistModal.tsx`**
- Add a toggle: "Full Checklist" vs "Creative Brief (for your team)"
- Creative Brief mode pre-selects the most relevant columns and uses simplified headers
- Brief mode adds a header row with brand name, offer name, and date

**File: `src/components/creative/ProductionChecklistPanel.tsx`**
- Add an "Export Brief" button alongside the existing export functionality

---

## Part 2: Data-Informed Creative Strategy

### How it works

```text
User opens Creative Studio
        |
        v
  [Check: Does this brand have
   a connected Meta account with
   active/recent campaigns?]
        |
   Yes /   \ No
      /     \
     v       v
 Fetch last   Use best-practices
 60-90 days   test mode: generate
 of ad data   a mix of formats
     |        (talking head, graphic,
     v        b-roll) to test what
 Analyze:     resonates
 - Which ads drove
   the most results?
 - What formats?
 - What hooks/angles?
 - Any patterns?
     |
     v
 Pass "creative intelligence"
 summary into the angle
 generation prompt
```

### Technical changes

**New edge function: `supabase/functions/analyze-past-creatives/index.ts`**
- Accepts `brandId` and `campaignObjective` (sales, leads, traffic)
- Fetches the brand's `meta_account_id` and `meta_access_token`
- Calls Meta API for ad-level insights over the last 90 days:
  - Fields: `ad_name, spend, impressions, clicks, ctr, actions, cost_per_action_type, purchase_roas`
- Filters to ads with significant spend (>$10) and reach (>1000)
- Groups by objective-relevant metric (purchases for sales, leads for leads, clicks for traffic)
- Sorts by best performers
- Uses Lovable AI to summarize patterns:
  - "Your top performers tend to be talking-head format with confession-style hooks"
  - "Short-form scripts (under 30s) outperform longer ones"
  - "Ads mentioning price directly got 2x more leads"
- Returns a structured `creativeIntelligence` object

**File: `src/pages/CreativeStudio.tsx`**
- Before angle generation, call `analyze-past-creatives` if the brand has a connected Meta account
- Show a brief "Analyzing your past ad performance..." loading state
- Display a summary card: "Based on your last 90 days: [key insights]" or "No past data found -- we'll test a proven creative mix"
- Pass the intelligence data into the `generate-creative-angles` function call

**File: `supabase/functions/generate-creative-angles/index.ts`**
- Accept optional `creativeIntelligence` parameter
- If present, inject it into the system prompt as high-priority context:
  - "The user's top-performing ads in the last 90 days show these patterns: [data]. Weight your angle suggestions toward what has proven to work, while still including 1-2 fresh test angles."
- If absent, use the existing best-practices approach but explicitly frame it as a test:
  - "This is the user's first campaign -- generate a balanced mix of formats and angles to test what resonates with their audience."

**File: `supabase/functions/generate-creative-grid/index.ts`**
- Accept optional `creativeIntelligence` parameter
- Use it to weight format distribution (e.g., if talking heads performed best, generate more talking head concepts)

---

## Part 3: Creative Intelligence Summary Card

**New component: `src/components/creative/CreativeIntelligenceCard.tsx`**
- Displayed at the top of the Angles tab when intelligence data is available
- Shows:
  - "Based on your last 90 days" or "First campaign -- testing mode"
  - Top performing format(s)
  - Key pattern (e.g., "Confession-style hooks drove 40% lower CPL")
  - Number of ads analyzed
- Collapsible for details
- Stored in `workspace.creative_json.creativeIntelligence` so it persists

---

## Files to create
- `supabase/functions/analyze-past-creatives/index.ts`
- `src/components/creative/CreativeIntelligenceCard.tsx`

## Files to modify
- `src/pages/CreativeStudio.tsx` -- add intelligence fetch + display card + pass data to generation
- `src/components/creative/ExportChecklistModal.tsx` -- add Creative Brief toggle
- `src/lib/export-production-checklist.ts` -- add `generateCreativeBriefCSV()`
- `src/components/creative/ProductionChecklistPanel.tsx` -- add Export Brief button
- `supabase/functions/generate-creative-angles/index.ts` -- accept + use intelligence data
- `supabase/functions/generate-creative-grid/index.ts` -- accept + use intelligence data
- `supabase/config.toml` -- register new edge function

