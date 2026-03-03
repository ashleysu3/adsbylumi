

## Add "Include Existing Posts" Option to Campaign Builder

### What this does
Adds an optional step in the Campaign Builder (Configure stage) that asks: "Do you have any existing posts you'd like to include as well?" Users can pick Instagram posts from their connected account, and those posts get added as additional ads alongside the generated creative assets when the campaign is published.

### Implementation

**1. Add post picker toggle + selector to `CampaignBuilderForm.tsx` and `MobileCampaignBuilder.tsx`**
- After the budget section, add a card: "Include existing posts?" with a toggle
- When toggled on, show the `SocialGrowthFlow` post picker (reuse the existing component in post-selection-only mode with `fixedObjective` set)
- Alternatively, build a simpler inline post picker that fetches from the same Instagram media endpoint and lets users check/uncheck posts
- Store selected posts in `answers.additionalPosts[]`

**2. Create a lightweight `ExistingPostPicker` component**
- Fetches Instagram posts using the existing `analyze-instagram-posts` edge function (already built)
- Grid of posts with checkboxes, thumbnail + caption preview
- Selected posts stored in campaign builder answers
- Only shown when brand has `instagram_account_id` connected

**3. Update `CampaignReview.tsx`**
- Show selected existing posts in the review screen alongside the generated creative summary
- Display count and thumbnails

**4. Update `build-meta-campaign` edge function**
- After creating standard ads from production items, check `answers.additionalPosts`
- For each additional post, create a "Use Existing Post" ad creative (same payload as `add-posts-to-campaign`: `object_id`, `instagram_user_id`, `source_instagram_media_id`)
- Add these ads to the same ad set
- Track success/failure in the result object

**5. Update `QACheckScreen` (if needed)**
- Include existing posts count in the pre-flight summary

### Files to create/edit
- **New**: `src/components/ExistingPostPicker.tsx` — reusable post picker with grid + checkboxes
- **Edit**: `src/components/CampaignBuilderForm.tsx` — add the "include existing posts" card
- **Edit**: `src/components/MobileCampaignBuilder.tsx` — same for mobile
- **Edit**: `src/components/CampaignReview.tsx` — show additional posts in review
- **Edit**: `supabase/functions/build-meta-campaign/index.ts` — create ads from existing posts after standard ads

### UX Flow
1. User sets budget → sees new card "Want to include existing posts too?"
2. Toggle on → post grid appears, user selects posts
3. Review screen shows both generated creatives and selected existing posts
4. On publish, standard ads are created first, then existing post ads are added to the same ad set

