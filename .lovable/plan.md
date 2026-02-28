

## Plan: Live/Bench Toggle + Creative Fatigue Settings + One-Press Refresh

### Changes Overview

Three features:
1. **Live vs Bench toggle** in both Campaign Builder review and Advanced Build review steps
2. **Creative Automation settings** fix in Settings (currently wired to wrong state variables) + add "notify only" vs "auto-rotate" preference
3. **One-press "Refresh Creative" button** on the Campaigns/Insights page when fatigue is detected and auto-rotate is OFF

---

### 1. Add "Go Live / Save to Bench" toggle

**`src/components/CampaignReview.tsx`**
- Add a second toggle alongside the existing Active/Paused toggle: "Destination: Go Live Now / Save to Bench"
- When "Save to Bench" is selected, the creative gets saved to `creative_bench` table with status `bench` instead of being pushed to Meta
- The launch status toggle still applies if "Go Live" is chosen

**`src/pages/AdvancedBuild.tsx`** (Step 3 — Review)
- Add the same "Go Live / Save to Bench" toggle before the "Build Campaign" button
- Add per-asset toggle or a global toggle: "Upload to Meta now" vs "Save to bench for later rotation"
- When bench is selected, save each asset to `creative_bench` with `status: 'bench'` and `auto_rotate_approved: true`

**`src/components/MobileCampaignReview.tsx`**
- Mirror the same bench toggle for mobile

### 2. Fix & Enhance Creative Automation Settings

**`src/pages/Settings.tsx`** — Creative Automation tab
- Currently the auto-rotate and auto-retest switches are incorrectly wired to `notificationPrefs.critical_alerts` and `notificationPrefs.performance_drops`
- Create dedicated state: `creativeAutomation` with fields: `auto_rotate_enabled`, `auto_retest_enabled`, `fatigue_threshold`, `retest_cooldown_days`, `fatigue_action` (`'auto_rotate' | 'notify_only'`)
- Save these to `brand.rotation_preferences` (or a new brand-level JSON field)
- Add a radio/select for "When fatigue is detected": Auto-rotate from bench / Just notify me
- When "Just notify me" is selected, show explanation that they'll get a notification + one-press button

### 3. One-Press "Refresh from Bench" Button

**`src/components/insights/CreativeBenchPanel.tsx`**
- Already has "Swap In" buttons per bench item — enhance with a prominent "Refresh All Fatigued" button at the top when fatigue is detected
- Show a banner: "X ads showing fatigue — Y bench creative ready" with a single "Swap Now" button

**`src/components/CampaignsList.tsx`** or workspace detail
- When `fatigue_detected` status exists in rotation logs, show an alert banner with a "Refresh Creative" button that invokes `rotate-creative` for all fatigued ads at once

### Files to Edit
- `src/components/CampaignReview.tsx` — add bench toggle
- `src/components/MobileCampaignReview.tsx` — add bench toggle
- `src/pages/AdvancedBuild.tsx` — add bench toggle on step 3
- `src/pages/Settings.tsx` — fix Creative Automation wiring, add notify-only option
- `src/components/insights/CreativeBenchPanel.tsx` — add bulk refresh button + fatigue banner

### No Database Changes Required
- `creative_bench` table already has the right schema
- `campaign_workspaces.rotation_preferences` already stores automation prefs
- Brand-level `notification_preferences` can store the `fatigue_action` preference

