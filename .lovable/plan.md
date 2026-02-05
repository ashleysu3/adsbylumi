

# Fix Meta OAuth "Please sign in" Error in Popup Flow

## Problem

When reconnecting Meta, users see "Please sign in to finish connecting your Meta account" error. This happens because:

1. User clicks "Reconnect Meta" which opens a popup
2. Popup redirects to Meta for authorization
3. Meta redirects back to `/meta-oauth-callback` in the popup
4. **The popup checks for a session but fails** - browsers with strict privacy settings (Safari, Incognito mode) block the popup from accessing the main window's session cookies
5. Popup just closes with an error toast, losing the OAuth code

## Solution

Instead of closing the popup with an error when session is missing, **convert the popup to a same-tab flow** by:

1. Detecting the session failure in the popup
2. Sending a message to the opener to close the popup gracefully
3. Navigating the **main window** to the callback URL (same-tab flow) which has proper session recovery

This leverages the existing same-tab flow that already shows a "Sign in to continue" button with a `returnTo` parameter.

---

## Part 1: Update Popup Session Failure Handling

### File: `src/pages/MetaOAuthCallback.tsx`

When the popup detects no session, instead of just closing with an error:

**Current behavior (lines 73-81):**
```typescript
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.opener.postMessage(
    { type: 'META_OAUTH_ERROR', error: 'Please sign in to finish connecting your Meta account.' },
    window.location.origin
  );
  window.close();
  return;
}
```

**New behavior:**
```typescript
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  // Session lost in popup (common with strict cookie policies)
  // Tell the opener to navigate to the callback URL directly (same-tab flow)
  // which has proper session recovery UI
  const callbackUrl = window.location.href;
  window.opener.postMessage(
    { 
      type: 'META_OAUTH_FALLBACK_TO_SAME_TAB', 
      callbackUrl 
    },
    window.location.origin
  );
  window.close();
  return;
}
```

---

## Part 2: Handle Fallback Message in MetaAccountConnect

### File: `src/components/MetaAccountConnect.tsx`

Add handling for the new `META_OAUTH_FALLBACK_TO_SAME_TAB` message in the popup callback handler:

**Add to the handleCallback function (around line 146):**
```typescript
} else if (event.data?.type === 'META_OAUTH_FALLBACK_TO_SAME_TAB') {
  // Popup lost session - redirect main window to callback URL (same-tab flow)
  popup?.close();
  window.removeEventListener('message', handleCallback);
  setOauthLoading(false);
  
  // Navigate main window to the callback URL - this triggers same-tab flow
  // which has proper "Sign in to continue" UI
  if (event.data.callbackUrl) {
    window.location.href = event.data.callbackUrl;
  } else {
    toast.error('Session lost. Please try again.');
  }
}
```

---

## Part 3: Improve Same-Tab Flow Messaging

### File: `src/pages/MetaOAuthCallback.tsx`

Make the "needs-auth" state messaging clearer:

**Update the needs-auth UI (lines 217-230):**
```typescript
{mode === "needs-auth" && (
  <div className="pt-2 space-y-3">
    <p className="text-xs text-muted-foreground">
      Your session expired during the connection. Sign in to complete the setup—your Meta authorization is saved.
    </p>
    <Button
      variant="lumi"
      className="w-full"
      onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(currentCallbackPath)}`)}
    >
      Sign in to continue
    </Button>
    <Button variant="ghost" className="w-full" onClick={() => navigate("/meta-settings")}
    >
      Cancel
    </Button>
  </div>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/MetaOAuthCallback.tsx` | Change popup no-session handling to send fallback message instead of error; improve needs-auth UI messaging |
| `src/components/MetaAccountConnect.tsx` | Add handler for `META_OAUTH_FALLBACK_TO_SAME_TAB` message to redirect main window |

---

## User Experience After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Popup loses session | Toast: "Please sign in..." then nothing | Main window redirects to callback with "Sign in to continue" button |
| User signs in | Nothing (stuck) | Returns to callback, completes OAuth automatically |
| OAuth data | Lost when popup closes | Preserved in sessionStorage, recovered after sign-in |

---

## Technical Notes

- The OAuth code and brandId are already saved to `sessionStorage` at the start of the callback (lines 24-38), so they survive the sign-in redirect
- The same-tab flow already handles recovery by checking `sessionStorage` for pending OAuth data
- This approach doesn't require any backend changes

