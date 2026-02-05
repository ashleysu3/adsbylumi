

# Fix Meta Connection "Issue" Error - Display Clear Error Details

## Problem Identified

When the Meta Settings page loads, it runs an auto-test of the connection. The `test-meta-connection` edge function is failing because:

1. **The function tries to read `meta_access_token` from the brands table** (line 67)
2. **But tokens are now stored in Supabase Vault**, not in the brands table
3. The function finds `token = null` and returns "No Meta access token found"
4. The UI shows "Issue" in a tiny badge with no actionable details

Even though the OAuth flow succeeded and stored a valid token in vault, the test function can't access it using the old method.

---

## Solution

Update `test-meta-connection` to retrieve the token from vault using the `get_meta_token` RPC function (same pattern used by other Meta functions like `sync-meta-campaigns`).

---

## Technical Changes

### File: `supabase/functions/test-meta-connection/index.ts`

Replace the direct table query with vault retrieval:

**Current code (lines 50-78):**
```typescript
const { data: brand, error: brandError } = await supabase
  .from('brands')
  .select('meta_account_id, page_id, page_name, meta_access_token')
  .eq('id', brandId)
  .single();

// ...

const token = brand.meta_access_token;
if (!token) {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'No Meta access token found',
      error: 'Please reconnect your Meta account.',
      details: { tokenValid: false },
    }),
    ...
  );
}
```

**New code:**
```typescript
// Fetch brand info
const { data: brand, error: brandError } = await supabase
  .from('brands')
  .select('meta_account_id, page_id, page_name')
  .eq('id', brandId)
  .single();

if (brandError || !brand) {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Brand not found',
      error: 'Could not load brand record',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// Get token from vault (same pattern as sync-meta-campaigns)
const { data: tokenData, error: tokenError } = await supabase.rpc('get_meta_token', {
  p_brand_id: brandId
});

const token = tokenData;
if (tokenError || !token) {
  console.log('No token found in vault for brand:', brandId, tokenError);
  return new Response(
    JSON.stringify({
      success: false,
      message: 'No Meta access token found',
      error: 'Your Meta token may have expired or been disconnected. Please reconnect your Meta account.',
      details: { tokenValid: false },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
```

---

## UI Enhancement: Show Error Details Prominently

Currently when auto-test fails, the error panel shows but users might miss it. The "Issue" badge at the top doesn't explain what's wrong.

### File: `src/pages/MetaSettings.tsx`

Add the error message inline with the "Issue" indicator:

**Current (lines 328-332):**
```tsx
{connectionHealth === 'error' && (
  <div className="flex items-center gap-1.5 text-destructive">
    <div className="h-2 w-2 rounded-full bg-destructive" />
    <span className="text-xs font-medium">Issue</span>
  </div>
)}
```

**Enhanced:**
```tsx
{connectionHealth === 'error' && (
  <div className="flex items-center gap-1.5 text-destructive">
    <div className="h-2 w-2 rounded-full bg-destructive" />
    <span className="text-xs font-medium">
      {testResult?.error ? 'Connection Issue' : 'Issue'}
    </span>
  </div>
)}
```

Also add a small inline alert right after the CardDescription when there's an error:

**After line 353 (after CardDescription), add:**
```tsx
{connectionHealth === 'error' && testResult?.error && (
  <Alert variant="destructive" className="mt-3">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription className="text-sm">
      <span className="font-medium">Connection issue: </span>
      {testResult.error}
    </AlertDescription>
  </Alert>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/test-meta-connection/index.ts` | Use `get_meta_token` RPC to retrieve token from vault instead of reading from brands table |
| `src/pages/MetaSettings.tsx` | Add inline error alert when connection test fails |

---

## Expected Result

| Before | After |
|--------|-------|
| "Issue" badge with no explanation | "Connection Issue" badge + inline alert showing the specific error |
| Test fails silently because token isn't in brands table | Test retrieves token from vault correctly |
| Users confused about what to do | Clear message: "Your Meta token may have expired. Please reconnect." |

