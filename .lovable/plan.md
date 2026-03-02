

## Plan: Dynamic Step Titles for Non-Offer Strategies

### Problem
When a user picks a system strategy (Increase Comments/DMs, Traffic to IG, Video Views, Grow Following), the wizard steps still say "Choose your offer" / "What are we promoting?" — which doesn't make sense since these strategies use existing posts, not offers.

### Change

**File: `src/pages/Create.tsx`**

Update `getStepTitle()` and `getStepSubtitle()` to check if `selectedOfferId` is a system offer (i.e., in `SYSTEM_OFFER_IDS`). If so:

- **Step 1 title**: "Choose your creative" → subtitle: "Select the posts you'd like to promote"
- **Step 2 title**: keep "Recommended strategy" (or skip if not shown for these flows)
- **Step 3 title**: keep "Campaign structure"

Since the social growth flow takes over step 1's content area when `showSocialGrowthFlow` is true, the title/subtitle just need to match. The check is simply:

```typescript
const isSystemOffer = SYSTEM_OFFER_IDS.includes(selectedOfferId);

case 1: return isSystemOffer ? "Choose your creative" : "Choose your offer";
// subtitle:
case 1: return isSystemOffer ? "Select the posts you'd like to promote" : "What are we promoting?";
```

Single file, ~4 lines changed.

