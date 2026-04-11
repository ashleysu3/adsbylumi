

# Instagram Post Selection via URL Paste with Thumbnail Preview

## Why a visual grid picker isn't possible
Browsing `/{ig-user-id}/media` requires `instagram_basic`, which Meta denied. No alternative Marketing API endpoint exposes the media list with just `ads_management`. This is a hard platform limitation.

## Solution: Paste-and-Preview UX
Users paste Instagram post URLs; the app instantly resolves thumbnails and metadata via the oEmbed API (uses an app-level token, zero user permissions needed). Multiple URLs can be pasted. The resolved `instagram_media_id` feeds directly into ad creation via the existing `source_instagram_media_id` flow.

## Changes

### 1. New edge function: `resolve-instagram-post`
- Accepts `{ url }` body
- Calls `GET https://graph.facebook.com/v21.0/instagram_oembed?url={url}&access_token={app_id}|{app_secret}` using `META_APP_ID` and `META_APP_SECRET` (already configured as secrets)
- Returns `{ thumbnail_url, author_name, html }` for instant preview
- Also extracts the media shortcode from the URL to resolve the `instagram_media_id` for ad creation (via `GET /ig_hashtag_search` or by parsing the oEmbed response)

### 2. Rewrite `ExistingPostPicker` component
- Replace the grid-of-thumbnails UI with a URL paste input
- User pastes an Instagram URL → calls `resolve-instagram-post` → shows thumbnail card with caption preview and remove button
- Support multiple URLs (paste one at a time or comma-separated)
- Keep the same `SelectedPost` interface and `onSelectionChange` callback so the campaign builder needs no changes
- Show a helper tip: "Open Instagram → tap ··· on a post → Copy Link → paste here"

### 3. Remove denied permissions from OAuth scope
- Update `meta-oauth-init` to drop `instagram_basic`, `instagram_manage_insights`, `pages_read_user_content`
- New scope: `ads_management,ads_read,business_management,pages_read_engagement,pages_show_list`

### 4. Clean up permission check/warning code
- Remove `InstagramPermissionFixModal` component and its usage
- Remove `instagram_basic` and `pages_read_user_content` from the required permissions check in `test-meta-connection`
- Update `analyze-instagram-posts` to return empty gracefully instead of erroring when media access fails

### Files
| File | Action |
|------|--------|
| `supabase/functions/resolve-instagram-post/index.ts` | Create — oEmbed resolver |
| `src/components/ExistingPostPicker.tsx` | Rewrite — URL paste with thumbnail preview |
| `supabase/functions/meta-oauth-init/index.ts` | Edit — remove denied scopes |
| `supabase/functions/test-meta-connection/index.ts` | Edit — remove IG permission checks |
| `src/components/InstagramPermissionFixModal.tsx` | Delete |
| `supabase/functions/analyze-instagram-posts/index.ts` | Edit — graceful degradation |
| Files importing `InstagramPermissionFixModal` | Edit — remove references |

