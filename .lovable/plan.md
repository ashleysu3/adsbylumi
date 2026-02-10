
# Fix Campaign Review: Remove Redundancy and Fix Instagram Post Truncation

## Problem
The Review step shows the same information twice: once in the main "Review Your Campaign" card (left) and again in the "Campaign Summary" sidebar (right). Budget, Schedule, Offer, Settings, and Creative Assets are all duplicated.

Additionally, Instagram post captions are cut off mid-word with no way to see the full text.

## Solution

### 1. Hide the Summary Sidebar on the Review Step
When the user is on the `review` stage, hide the `CampaignSummary` sidebar entirely. The Review card already contains all the information in a more detailed format -- the sidebar adds nothing at this point.

**File: `src/pages/CampaignBuilder.tsx`**
- Conditionally render `CampaignSummary` only when `stage !== 'review'` (and not `publishing` or `success` either, since those don't need it).
- Make the main content area take the full width (`lg:col-span-3`) when the sidebar is hidden.

### 2. Fix Instagram Post Caption Truncation
In `CampaignReview.tsx`, the Instagram post captions are sliced to 60 characters (`post.caption?.slice(0, 60)`), cutting words mid-sentence. Instead, show a longer portion with proper line clamping so the text wraps naturally and doesn't break mid-word.

**File: `src/components/CampaignReview.tsx`**
- Remove the `.slice(0, 60)` truncation on post captions
- Use `line-clamp-2` CSS class instead, so the browser handles word-boundary wrapping gracefully
- Also apply the same fix to `MobileCampaignReview.tsx` where captions are sliced to 40 characters

## Technical Details

### CampaignBuilder.tsx changes
```text
- Wrap CampaignSummary in a condition: only show when stage is 'questions'
- Adjust grid column span: main content gets lg:col-span-3 when sidebar is hidden
```

### CampaignReview.tsx changes
```text
- Line ~360: Change post.caption?.slice(0, 60) to post.caption with line-clamp-2
```

### MobileCampaignReview.tsx changes
```text
- Fix post.caption?.slice(0, 40) similarly
```
