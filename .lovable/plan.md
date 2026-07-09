# Autosave everywhere

## Goal
No user should ever click "Save" or lose changes. Every editable field writes itself back to the database on change (debounced), flushes on navigation / tab close, and shows a small "Saving… / Saved" indicator instead of a button.

We already have the primitive: `useAutosave` (debounce + flush-on-unmount + flush-on-hide + beforeunload guard) and the `AutoSaveIndicator` component. This work is about applying them everywhere and deleting the manual Save UI.

## Scope

### In scope — user-facing editors that currently require a manual save
Grouped by area. Each becomes "type → autosaves → indicator in the corner":

- **Brand / Style**
  - `src/pages/Style.tsx` (brand details, emoji settings, overlay style)
  - `src/components/BrandColorsAndFonts.tsx`
  - `src/components/BrandEditDialog.tsx`
  - `src/components/BrandVoiceCard.tsx`
  - `src/components/OverlayStylePicker.tsx`
  - `src/pages/BrandSetup.tsx`
- **Offers / Audience**
  - `src/components/OfferEditDialog.tsx`, `OfferMessagingEditor.tsx`
  - `src/components/AudiencePsychology.tsx`
- **Campaigns / Creative**
  - `src/pages/CreativeStudio.tsx`
  - `src/components/creative/AngleCopyEditor.tsx`
  - `src/components/MobileCampaignReview.tsx`
  - `src/components/insights/CampaignGoalRow.tsx`
- **Content / Ads Manager**
  - `src/pages/ContentLibrary.tsx`
  - `src/pages/AdsManager.tsx`
  - `src/components/ads-manager/ReviewForm.tsx`, `ReportDraftPreview.tsx`
- **Settings**
  - `src/pages/AgencySettings.tsx`
  - `src/components/PixelVerificationCard.tsx`

### Explicitly out of scope
- **Destructive / transactional actions**: publish, launch campaign, send email, checkout, delete, "Apply brand guide" — these stay as explicit buttons. Autosave is for edits to your own data, not for firing side-effects.
- **Admin console pages** (`src/pages/admin/*`): different UX (bulk edits, moderator intent). Keep manual save.
- **Onboarding wizards** (`GuidedOnboarding.tsx`, `Onboarding.tsx`): step-based flows where "Next" is the save. Untouched.
- **Auth / password change**: security-sensitive, must stay explicit.

## How it works

1. **One shared hook per editor.** Each editor component gets a `useAutosave` instance with a saver that upserts the current form state to the right table (`brands`, `brand_kits`, `offers`, `campaign_workspaces`, etc.). Debounce stays at 1500ms; existing behavior (flush on unmount, hide, beforeunload) is already correct.

2. **One shared status pill.** Replace every "Save" button with `<AutoSaveIndicator status={status} />` in the card header or dialog footer. Users see "Saving…" while typing, "Saved" after, "Retrying…" on error.

3. **Dialogs never block on save.** `BrandEditDialog`, `OfferEditDialog`, etc. call `await flush()` in their close handler so the row is guaranteed persisted before the dialog unmounts — but the user just clicks the X or outside, no "Save & close".

4. **Optimistic UI.** Local state updates immediately. Errors re-queue via the hook's existing retry, and we surface a toast only if the same save fails twice in a row (to avoid noise on flaky networks).

5. **Cleanup.** Delete now-unused `handleSave*` functions, `saving` state, and Save button JSX from each file in scope.

## Rollout order (small, verifiable batches)

Instead of one giant PR, ship in four passes so each is testable:

1. Style page cluster — brand details, colors/fonts, emoji, overlay style, voice card. (Highest visible payoff, all edits are simple field-updates.)
2. Offers + Audience editors.
3. Creative Studio + AngleCopyEditor + CampaignGoalRow.
4. Ads Manager review/report + Agency settings + Pixel card.

After each batch: build passes, visit the page in the preview, confirm the indicator shows Saving → Saved and reload shows the value persisted.

## What the user will notice

- No more "Save" buttons on brand, style, offers, audience, creative, and content editors.
- A subtle "Saving… / Saved just now" indicator in the top-right of each card / dialog.
- Closing a dialog or navigating away never loses input, even mid-keystroke.
- Publish, launch, send, delete, and checkout still require an explicit click — those are actions, not edits.

## Technical notes

- No schema changes. All target tables already exist and are being written to today.
- No new dependencies; `useAutosave` + `AutoSaveIndicator` are already in the repo.
- Each saver is scoped to the row currently loaded (brand id, offer id, workspace id) so there is no risk of cross-record writes.
- The hook already handles: debounce, flush on unmount, flush on tab hide, `beforeunload` warning when a write is pending, and automatic retry on failure.
