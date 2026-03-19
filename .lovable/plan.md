

## Fix: Instagram Posts Showing "No Posts Found" Instead of Permission Error

### Root Cause

The edge function `analyze-instagram-posts` correctly detects the Meta API error (code 10: "Application does not have permission for this action") and returns a 400 response with an error message. However, `supabase.functions.invoke` does not throw on non-2xx responses -- it returns the error body in `data`. So:

1. `fetchError` is `null` (no network error)
2. `data` contains `{ error: "Instagram permissions need to be updated..." }`
3. The code reads `data.posts` which is `undefined`, defaults to `[]`
4. The UI shows "No posts found" instead of the actual permission error

### Fix

In **`src/components/SocialGrowthFlow.tsx`** `fetchPosts()` function (~line 84-88):
- After checking `fetchError`, also check if `data?.error` exists and throw it
- This surfaces the real error message ("Instagram permissions need to be updated. Please disconnect and reconnect your Meta account in Settings")

Same fix in **`src/components/ExistingPostPicker.tsx`** `fetchPosts()` (~line 42-48):
- Same pattern: check `data?.error` before reading `data?.posts`

Additionally, improve the error display in `SocialGrowthFlow`:
- When `error` state is set and we're on `post_selection` step, show the error message with a reconnect prompt instead of "No posts found"
- Add a "Reconnect Meta" button that links to `/settings/meta`

### Files Changed

| File | Change |
|------|--------|
| `src/components/SocialGrowthFlow.tsx` | Check `data?.error` after invoke; show error with reconnect CTA |
| `src/components/ExistingPostPicker.tsx` | Check `data?.error` after invoke |

