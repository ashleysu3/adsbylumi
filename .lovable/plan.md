

## Plan: Fix Campaign Detail View — 3 Issues

### 1. Remove "Everything looks good" empty state from LumiRecommendations

**File: `src/components/insights/LumiRecommendations.tsx`** (lines 218-229)

When `allRecommendations.length === 0`, instead of rendering the green "Everything looks good!" card, render nothing (just return `<div ref={recsRef} />` to preserve the scroll anchor).

### 2. Fix "What To Do Next" formatting — raw markdown and internal IDs showing

**File: `src/components/insights/CampaignInsightDetail.tsx`** (lines 494-497)

The `nextSteps[0]` text contains raw markdown (`**bold**`) and internal identifiers like `'elevate_client_experience_attention_talking_head'`. Clean the text before display:
- Strip markdown bold markers (`**`)
- Strip anything that looks like an internal slug (single-quoted snake_case identifiers)
- Truncate to ~120 chars with ellipsis

### 3. Add "Refresh Your Creative" button that navigates to Creative Studio

**File: `src/components/insights/CampaignInsightDetail.tsx`**

Add a prominent "Refresh Your Creative" button in the Budget Recommendation area (lines 555-571). When the budget verdict is "Refresh your creative first", replace/augment it with a button that navigates to `/creative-studio?workspace=${campaign.id}&refreshCreative=true`, which triggers the existing Smart Creative Refresh flow.

Also add this button to the "What To Do Next" card when frequency is high or status is critical/attention — making it the primary CTA.

### Summary of changes

```text
LumiRecommendations.tsx:
  - Empty state: render invisible anchor div instead of green "Everything looks good" card

CampaignInsightDetail.tsx:
  - "What To Do Next" text: strip markdown + internal slugs before display
  - Budget Recommendation card: when verdict is "Refresh your creative first",
    add a "Refresh Your Creative →" button that navigates to creative studio
    with refreshCreative=true param
```

