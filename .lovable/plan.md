

# Fix Social Growth Flow: Use Existing Posts Only (No Creative Studio)

## What's Changing

The "Grow Social Following" flow currently analyzes posts with AI, shows recommendations, offers content suggestions, and then sends the user to Creative Studio. This is overengineered for what is essentially an "existing post" campaign.

The new flow will mirror how Meta Ads Manager works: pull up the user's Instagram posts, let them pick which ones to promote, and go straight to campaign building. No Creative Studio, no AI analysis, no content suggestions.

## New Flow

```text
1. Pick objective (Traffic to IG / Video Views)
2. Fetch Instagram posts (simple grid -- no AI scoring)
3. User selects posts (up to 6)
4. Create workspace with selected posts + go to campaign build
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/SocialGrowthFlow.tsx` | Major simplification: Remove "analyzing" spinner step, remove AI analysis call, remove "content_suggestions" step entirely. Fetch posts directly from Instagram Graph API (simple fetch, no AI scoring). Show all posts in a clean grid. Remove `is_recommended` / `ai_recommendation` / `engagement_score` filtering. Increase max selection from 3 to 6. Remove "Get content ideas instead" fallback. |
| `src/pages/Create.tsx` | Change `onComplete` handler: instead of navigating to `/creative-studio?type=social-growth`, create a strategy + workspace record with the selected post IDs/URLs stored in `creative_json`, then navigate directly to campaign review/build. |
| `supabase/functions/analyze-instagram-posts/index.ts` | Add a `simple` mode that just fetches posts from the Instagram Graph API without calling the AI for scoring/analysis. This keeps the edge function reusable for the future AI recommendation feature. |

## Technical Details

### SocialGrowthFlow.tsx -- Simplified Component

Remove these flow steps entirely:
- `"analyzing"` (the Lumi spinner)
- `"content_suggestions"` (the fallback ideas)

New step flow: `"objective"` -> `"post_selection"` only.

When user picks objective and clicks Continue:
- Call the edge function with a `simple: true` flag
- Edge function returns raw posts (no AI analysis)
- Go straight to post_selection grid

Post selection grid changes:
- Remove "Recommended" vs "Other" separation -- just show all posts in a flat grid
- Increase max from 3 to 6 posts
- Remove the "None of these? Get content ideas" button
- Keep the PostCard component but remove `is_recommended` badge logic

### Create.tsx -- Direct to Campaign Build

Replace the `onComplete` callback:

```ts
onComplete={(data) => {
  // Create workspace directly with selected posts
  // Store selected post IDs + media URLs in creative_json
  // Navigate to campaign build/review (not creative studio)
}}
```

The workspace `creative_json` will store:
```json
{
  "socialGrowth": true,
  "objective": "traffic",
  "selectedPosts": [
    { "id": "...", "media_url": "...", "media_type": "VIDEO", "permalink": "..." }
  ]
}
```

Set `progress_status` to `"ready_to_build"` instead of `"creative_in_progress"` since no creative generation is needed.

### Edge Function -- Simple Mode

Add a `simple` boolean parameter. When `true`:
- Fetch posts from `/{instagram_account_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25`
- Return them directly without calling the AI model
- This keeps the function ready for when you want Lumi to suggest posts in the future (just pass `simple: false`)

