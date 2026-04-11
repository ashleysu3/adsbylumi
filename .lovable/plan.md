

# Fix: Silent Permission Upgrade on Reconnect + Clear Messaging

## The Problem
`instagram_basic` is now in the OAuth scope, so new connections automatically include it. But existing users connected *before* this change — their tokens don't have `instagram_basic`. When the post picker fails to load posts, the fallback messaging is confusing because it implies users need to do something special when reconnecting, but Meta's OAuth is all-or-nothing (no permission toggles).

## Solution
Two changes:

### 1. Auto-detect missing permission and show a single clear banner
When the post picker gets a fallback/error from `analyze-instagram-posts`, instead of a generic fallback, show a specific one-time banner:

> **"We've added new features! Reconnect your Meta account to enable post browsing."**
> [Reconnect Now] button that takes them to Meta Settings

No mention of "permissions" or "instagram_basic" — just a simple upgrade prompt. Once they reconnect (which automatically includes the new scope), posts load normally.

### 2. Clean up confusing permission-related messaging
Update the troubleshooting text in `MetaSettings.tsx` and `MetaAccountConnect.tsx` to remove references to "Instagram scopes" and "permission toggles" that users can't control. Replace with actionable language like "Try disconnecting and reconnecting."

## Files

| File | Change |
|------|--------|
| `src/components/ExistingPostPicker.tsx` | Replace generic fallback with clear "reconnect to unlock" banner with a direct link to Meta Settings |
| `src/pages/MetaSettings.tsx` | Simplify troubleshooting tips — remove "Instagram scopes" language, keep it action-oriented |
| `src/components/MetaAccountConnect.tsx` | Remove confusing permission-specific messaging |

