

# Scrape Instagram Posts into Lumi + Better Error Handling

## The Approach

Use **Firecrawl** (already connected as a connector) to scrape the user's Instagram profile page and extract their recent post thumbnails and URLs. This gives users a visual grid to pick from — no need to leave the app or copy URLs manually.

For posts that can't be used as ads, we add pre-validation and friendly error messages so users understand what happened before they waste time.

## How It Works

```text
User enters Instagram handle
        ↓
Firecrawl scrapes instagram.com/@handle
        ↓
Parse HTML for post thumbnails + shortcodes
        ↓
Display visual grid → user picks posts
        ↓
On submit, resolve shortcode → Instagram media ID
via Marketing API (ads_management permission)
        ↓
Create ad creative using source_instagram_media_id
```

## Changes

### 1. New edge function: `scrape-instagram-profile`
- Accepts `{ username }` (or pulls from brand's `instagram_account_name`)
- Uses Firecrawl to scrape `https://www.instagram.com/{username}/` with `formats: ['html', 'links']`
- Parses the response to extract post URLs, thumbnails, and shortcodes from the page HTML
- Returns an array of `{ shortcode, permalink, thumbnail_url, media_type }` for up to 12-18 recent posts
- Falls back gracefully if Firecrawl can't access the profile (private account, rate limit)

### 2. Update `resolve-instagram-post` to resolve the actual media ID
- After extracting the shortcode from a URL, call the Marketing API to resolve the numeric `instagram_media_id`:
  `GET /{ig_account_id}/media?fields=id,shortcode&limit=50` using the user's access token (we have `ads_management`)
- Wait — this still requires `instagram_basic`. Alternative: use `source_instagram_media_id` with the **shortcode-based ID**. Meta actually accepts the post permalink directly in some creative flows.
- Better approach: Use the **oEmbed endpoint** with app token to get the `media_id` from the response, OR use Firecrawl's JSON extraction to pull the media ID from Instagram's embedded JSON data on the post page.

### 3. Rewrite `SocialGrowthFlow` post selection step
- Instead of calling `analyze-instagram-posts` (which needs `instagram_basic`), call `scrape-instagram-profile`
- Display scraped posts in the existing visual grid picker
- Keep the URL paste input as a fallback below the grid ("Don't see your post? Paste the URL")
- Auto-populate the username from `instagramAccountName` stored on the brand

### 4. Pre-validation for ad eligibility
- Before submitting posts to `add-posts-to-campaign`, add a check in the edge function:
  - Try creating the creative first, and if it fails, return a **specific, friendly error** per post
  - Common Meta error translations:
    - "This post contains copyrighted music" → "This post has licensed music that Meta won't allow in ads. Try a different post."
    - "Invalid media" → "This post type can't be promoted as an ad. Try a photo or Reel instead."
    - "Post not found" → "We couldn't find this post. It may have been deleted or is from a private account."
    - Generic → "Meta couldn't use this post as an ad. Try a different one."

### 5. Better UX for partial failures in `add-posts-to-campaign`
- Update the frontend to show per-post success/failure results after submission
- Show a card for each post with green check or red X and the specific reason
- Let users remove failed posts and retry with different ones
- Replace raw Meta error codes with the friendly translations from step 4

### 6. Clean up remaining `instagram_basic` references
- Remove the permission warning logic in `meta-oauth-callback` (lines 383-391 and 397-410)
- These checks will always warn since we no longer request those permissions

## Technical Details

**Firecrawl scraping** — Instagram profile pages contain JSON-LD and embedded data with post info. Firecrawl handles JavaScript rendering, so it can access the dynamically loaded content. We use the `html` format and parse for post shortcodes and thumbnail URLs from the page's `<meta>` tags and embedded JSON.

**Media ID resolution** — The `source_instagram_media_id` field in Meta's ad creative API needs the numeric IG media ID. We can resolve this by scraping the individual post page (which contains the media ID in embedded JSON) or by using the oEmbed API response which sometimes includes it.

**Fallback chain**: Firecrawl grid → URL paste → manual entry. Users always have a way to add posts.

## Files

| File | Action |
|------|--------|
| `supabase/functions/scrape-instagram-profile/index.ts` | Create — Firecrawl-powered profile scraper |
| `supabase/functions/resolve-instagram-post/index.ts` | Edit — add media ID resolution via page scraping |
| `src/components/SocialGrowthFlow.tsx` | Edit — use scraper instead of `analyze-instagram-posts` |
| `src/components/ExistingPostPicker.tsx` | Edit — add scraped grid above URL input |
| `supabase/functions/add-posts-to-campaign/index.ts` | Edit — friendly error translations |
| `supabase/functions/meta-oauth-callback/index.ts` | Edit — remove `instagram_basic` warning logic |

