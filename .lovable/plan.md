

## Plan: Add "Add More Posts" and "Refresh Creative" Actions to Campaign Dropdown

### What changes

In `src/components/CampaignsList.tsx`, the per-campaign dropdown menu (lines 450-504) currently shows "Advanced Upload" for non-social campaigns and "Archive" for all. We need to add two context-aware actions:

1. **Social campaigns** (existing post campaigns): Add "Add More Posts" option that navigates to `/creative-studio?workspace={id}&selectPosts=true` — the existing social post selection flow.

2. **Non-social campaigns** (uploaded/custom creative): Add "Refresh Creative" option that navigates to `/creative-studio?workspace={id}&refreshCreative=true` — the existing Smart Creative Refresh flow.

### Implementation detail

In the dropdown menu (around lines 456-491), restructure the conditional rendering:

- **If social campaign**: Show "Add More Posts" with a `Plus` icon, navigating to the selectPosts flow
- **If non-social campaign**: Keep existing "Advanced Upload" option, and add a new "Refresh Creative" option with a `RefreshCw` icon, navigating to the refreshCreative flow
- Archive remains for all campaigns

Both actions use existing flows — no new pages or edge functions needed. Just two new `DropdownMenuItem` entries with conditional logic based on the `social` boolean already computed on line 379.

### Files to edit
- `src/components/CampaignsList.tsx` — add dropdown menu items

