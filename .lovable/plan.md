

## Fix Weekly Reports & Improve Onboarding

### Three issues to address:

1. **Weekly reports: one per account, not per campaign** — Currently `run-optimization-report` already aggregates ALL campaigns for a brand into a single report. The report is already account-level. The digest email (`send-optimization-digest`) sends one email per brand. This is working correctly at the data level. However, `schedule-digests` iterates per-workspace and could be generating duplicate calls. Need to verify and fix.

2. **Make users aware of weekly reports** — Digest settings are buried in the Results page behind a settings dialog. Users don't know they exist. Need to surface this in the onboarding checklist and Start page.

3. **Tighten onboarding flow** — The onboarding checklist is dismissible and the wizard can be skipped. Need to make setup steps more required so nothing falls through the cracks.

---

### Plan

**1. Fix schedule-digests to be one-report-per-brand (not per-workspace)**

In `schedule-digests/index.ts`, the code fetches workspaces but only uses them to check if any exist — it then calls `run-optimization-report` once per brand with the `brandId`. This is correct. No change needed here.

However, confirm the digest settings `enabled: true` default means new rows auto-enable. Currently the table default is `enabled = true`, but **no digest_settings row is created during onboarding**. This means no user gets weekly reports unless they manually find and configure them in the Results page.

**2. Auto-create digest_settings during brand onboarding**

In `src/pages/Onboarding.tsx`, after the brand is created (step 1 save), automatically insert a `digest_settings` row with sensible defaults (enabled, Monday at 8am). This ensures every new user gets weekly reports by default.

Also add the same auto-creation in `src/pages/Dashboard.tsx` — when loading brand data, if no digest_settings exist for the brand, create one with defaults.

**3. Add "Weekly Reports" step to OnboardingChecklist**

Add a new checklist item in `OnboardingChecklist.tsx`:
- Title: "Enable Weekly Reports"  
- Description: "Get automated performance digests delivered to your inbox"
- Completed: check if `digest_settings` exists and is enabled for the brand
- Action: navigate to `/data` and open digest settings

**4. Add weekly reports nudge to Start page**

In `Start.tsx`, add an attention item when the user has live campaigns but no digest settings configured, prompting them to enable weekly reports.

**5. Make onboarding checklist non-dismissible until complete**

In `OnboardingChecklist.tsx`, remove the dismiss (X) button. The checklist should only disappear when all steps are completed. In `Dashboard.tsx`, stop using `localStorage` for `checklistDismissed` — always show the checklist if steps remain incomplete.

**6. Make onboarding wizard steps required**

In `BrandOnboardingWizard.tsx`, prevent skipping steps that aren't complete — disable the "Next" button until the current step's requirements are met. Remove the dismiss/close button from the wizard. Only allow closing once all required steps (Brand Basics, Positioning, at minimum) are done.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Onboarding.tsx` | Auto-create digest_settings row after brand creation |
| `src/pages/Dashboard.tsx` | Auto-create digest_settings if missing; remove dismissible checklist logic |
| `src/components/OnboardingChecklist.tsx` | Add "Enable Weekly Reports" step; remove dismiss button |
| `src/components/BrandOnboardingWizard.tsx` | Make steps non-skippable; remove dismiss button until basics done |
| `src/pages/Start.tsx` | Add "Enable weekly reports" attention item for users with live campaigns |

