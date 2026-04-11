

# Re-enable Instagram Post Grid via API + Keep URL Paste as Fallback

## What's happening now
The `analyze-instagram-posts` edge function already has working code to fetch posts via `/{ig-user-id}/media` using `instagram_basic`. But the UI was changed to skip calling it and only show a URL paste input. Since you have Basic Access to `instagram_basic`, we just need to add it back to the OAuth scope and re-wire the UI to call the existing function.

## Changes

### 1. Add `instagram_basic` back to OAuth scope
**File:** `supabase/functions/meta-oauth-init/index.ts`
- Add `instagram_basic` to the scope string (line 95)
- New scope: `ads_management,ads_read,business_management,pages_read_engagement,pages_show_list,instagram_basic`

### 2. Re-wire SocialGrowthFlow to auto-load posts
**File:** `src/components/SocialGrowthFlow.tsx`
- When entering the `post_selection` step, call `analyze-instagram-posts` with `simple: true` to fetch the visual grid
- Display the grid of posts above the URL paste input
- If the API returns `fallbackMode: 'url_paste'` or errors, gracefully show only the URL paste input (no error wall)
- Keep URL paste as a secondary "Don't see your post?" option below the grid

### 3. Re-wire ExistingPostPicker to auto-load posts
**File:** `src/components/ExistingPostPicker.tsx`
- On mount, call `analyze-instagram-posts` with `simple: true` using the brand's `instagramAccountId`
- Display returned posts as a tappable grid (already has the grid UI code from the scraper version)
- Keep URL paste below as fallback

### 4. Users must re-authorize
Since `instagram_basic` wasn't in the OAuth scope before, existing users will need to reconnect their Meta account to grant the new permission. The `auth_type: 'rerequest'` flag is already set, so this will happen automatically on next reconnect.

## Technical notes
- `analyze-instagram-posts` with `simple: true` returns raw posts without AI analysis — fast and lightweight
- The function already handles Code 10 errors gracefully, returning `fallbackMode: 'url_paste'`
- No new edge functions needed — everything already exists
- The scrape-instagram-profile function stays as-is (unused but harmless)

## Files
| File | Action |
|------|--------|
| `supabase/functions/meta-oauth-init/index.ts` | Edit — add `instagram_basic` to scope |
| `src/components/SocialGrowthFlow.tsx` | Edit — call `analyze-instagram-posts` on post_selection step |
| `src/components/ExistingPostPicker.tsx` | Edit — auto-load posts on mount via API |

