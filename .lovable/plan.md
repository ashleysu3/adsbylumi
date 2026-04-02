

# Meta Setup Assistance System — Full Build

## Priority Order
1 → Pre-Connection Diagnostic Scanner
4 → Lumi Setup Concierge Mode
2 → Interactive Fix-It Guides
3 → Auto-Linking Enhancements (already partially done)
5 → Call Booking Fallback

---

## Phase 1: Pre-Connection Diagnostic Scanner

**New Edge Function:** `supabase/functions/diagnose-meta-setup/index.ts`

After OAuth completes and assets are fetched, run a diagnostic scan that audits:
- **Facebook Page exists?** — Check if any pages were returned
- **Instagram linked to Page?** — Check if IG accounts have a `linked_page_id` matching a discovered page
- **Ad Account active?** — Check `account_status === 1`
- **Ad Account linked to Page?** — Query `/{ad_account_id}/assigned_pages` to verify
- **Billing set up?** — Query `/{ad_account_id}?fields=funding_source_details` to check for payment method
- **Pixel exists?** — Query `/{ad_account_id}/adspixels` to check for at least one pixel

Returns a structured health report with `status` (pass/warn/fail) and plain-English `fix` instructions per item.

**New Component:** `src/components/MetaSetupDiagnostic.tsx`

A card that renders the diagnostic results as a visual checklist with:
- Green check / amber warning / red X per item
- Plain-English description of what's wrong and how to fix it
- Expandable "How to fix" section per item with step-by-step instructions
- Overall "health score" (e.g., 5/6 ready)

**Integration Points:**
- `MetaAccountConnect.tsx` — After OAuth callback returns assets, auto-invoke the diagnostic function and store results in state. Show the diagnostic card above the account/page selection step.
- `MetaSettings.tsx` — Show diagnostic card when connected but health isn't perfect (replaces/augments the existing `MetaReadinessChecklist`).
- `meta-oauth-callback/index.ts` — Add billing + pixel checks to the existing asset discovery flow so the diagnostic data comes back with the initial OAuth response (no second round-trip needed).

---

## Phase 2: Lumi Setup Concierge Mode

**File:** `supabase/functions/lumi-chat/index.ts`

Add a new context mode `meta-setup-concierge` with a dedicated system prompt:

```
You are Lumi in Setup Concierge mode. The user is trying to connect their Meta Business account.
Here is their current setup status: {diagnostic_results}

Guide them step-by-step through fixing each issue. Be specific — mention exact menu paths in Meta Business Suite.
For example: "Go to business.facebook.com → Settings → Pages → Add → select your Page"

Common issues and fixes:
- No Facebook Page: Create one at facebook.com/pages/create
- Instagram not linked: Instagram app → Settings → Account → Linked Accounts → Facebook
- No ad account: business.facebook.com → Settings → Ad Accounts → Add
- No billing: business.facebook.com → Billing → Payment Methods → Add
- No pixel: business.facebook.com → Events Manager → Connect Data Sources → Web → Meta Pixel
```

**File:** `src/components/LumiAssistant.tsx`

- Add `meta-setup` to `contextStarters` with setup-specific quick actions:
  - "Help me connect" / "I don't have a Facebook Page" / "My Instagram isn't showing" / "Where do I add billing?"
- When on `/meta-settings`, auto-inject diagnostic results into the Lumi context so the AI knows exactly what's missing

**File:** `src/pages/MetaSettings.tsx`

- Add a prominent "Need help? Ask Lumi" button near the diagnostic card that opens Lumi with the setup concierge context pre-loaded

---

## Phase 3: Interactive Fix-It Guides

**File:** `src/components/MetaSetupDiagnostic.tsx` (extend)

For each failed diagnostic item, add an expandable guide section with:
- Step-by-step numbered instructions with exact Meta Business Suite menu paths
- External links that open the exact Meta settings page (e.g., `https://business.facebook.com/settings/pages`)
- Estimated time to complete (e.g., "~2 minutes")
- A "Done — Re-check" button that re-runs just that specific diagnostic

Top 3 fix-it guides:
1. **Instagram not linked to Page**: Settings → Instagram Accounts → Connect → Log in → Select Page
2. **No billing/payment method**: Business Settings → Billing → Payment Methods → Add Card
3. **No Facebook Page**: facebook.com/pages/create → Fill details → Connect to Business Manager

---

## Phase 4: Auto-Linking Enhancements

**File:** `supabase/functions/meta-oauth-callback/index.ts`

The auto-connect IG → ad account logic already exists (lines 316-340). Enhance it:
- When only 1 ad account + 1 page + 1 IG account are found, auto-select all three and save to the brand record immediately (skip the selection UI entirely)
- Log auto-selections so user sees "We automatically selected your only ad account, Page, and Instagram" in a success toast
- After auto-selection, still show the diagnostic card so they can verify everything looks right

**File:** `src/components/MetaAccountConnect.tsx`

- Detect single-option scenarios and show a confirmation card instead of radio buttons: "We found one ad account (Act 12345), one Page (My Brand), and one Instagram (@mybrand). Does this look right?"
- Single "Confirm & Continue" button

---

## Phase 5: Call Booking Fallback

**File:** `src/components/MetaSetupDiagnostic.tsx` (extend)

- After 2+ failed re-checks OR if diagnostic shows 3+ failing items, show a "Need hands-on help?" card with:
  - Brief message: "Some setups need a quick walkthrough. Book a free 15-minute setup call with our team."
  - Button that either opens a Calendly/booking link or submits a help ticket through the existing bug report system with category `setup_help`
  - The ticket auto-includes the diagnostic results so support knows exactly what's wrong

---

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/meta-oauth-callback/index.ts` | Add billing + pixel diagnostic checks to response; auto-select single-option scenarios |
| `supabase/functions/diagnose-meta-setup/index.ts` | **New** — standalone diagnostic function for re-checks |
| `src/components/MetaSetupDiagnostic.tsx` | **New** — diagnostic card with health report, fix-it guides, re-check, and booking fallback |
| `src/components/MetaAccountConnect.tsx` | Show diagnostic after OAuth; single-option confirmation flow |
| `src/pages/MetaSettings.tsx` | Integrate diagnostic card; "Ask Lumi" button |
| `supabase/functions/lumi-chat/index.ts` | Add setup concierge system prompt + context handling |
| `src/components/LumiAssistant.tsx` | Add meta-setup context starters; inject diagnostic data |

