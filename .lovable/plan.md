

# Simplified Meta Setup & Event Tracking for Non-Tech Users

## The Problem
Users who aren't tech-savvy face two friction points:
1. **During onboarding**: They don't know if they have all the Meta pieces connected (Facebook Page, Instagram Business, Ad Account, Pixel)
2. **For each new campaign**: They need the right conversion event (Lead or Purchase) firing on their landing page, and currently the tools to verify this are buried in settings

## Solution Overview

### 1. Meta Readiness Checklist (Onboarding + Settings)
A visual checklist component that shows green/red status for each required piece, with plain-language "Fix this" guidance:

```text
+----------------------------------------------+
|  Getting Your Ads Ready                      |
|                                              |
|  [x] Facebook Page connected                |
|  [x] Instagram account linked               |
|  [x] Ad account selected                    |
|  [ ] Pixel installed on your website         |
|      "Your pixel tracks who visits your      |
|       site so Meta knows your ads work"      |
|      [Show me how ->]                        |
|                                              |
|  [x] = green checkmark, [ ] = red circle    |
+----------------------------------------------+
```

- Displayed after Meta OAuth completes in the onboarding wizard (Step 5)
- Also shown on the Meta Settings page as a summary card
- Each incomplete item has a one-sentence explanation (no jargon) and an action button

### 2. Event Setup Assistant (Campaign Builder)
When a user creates a Lead or Sales campaign, a friendly wizard checks if the right event is firing on their offer URL:

```text
+----------------------------------------------+
|  Let's make sure Meta can track results      |
|                                              |
|  Your campaign goal: Leads                   |
|  Your landing page: example.com/webinar      |
|                                              |
|  Checking your page...                       |
|                                              |
|  Result:                                     |
|  [!] We couldn't detect a "Lead" event       |
|      on this page.                           |
|                                              |
|  What does this mean?                        |
|  "When someone fills out your form, Meta     |
|   needs a small signal to know it worked.    |
|   Without it, Meta can't optimize your ads." |
|                                              |
|  How to fix it:                              |
|  [Shopify] [WordPress] [Kajabi] [Other]      |
|                                              |
|  Or: [Copy this code snippet]               |
|  Or: [Skip for now - I'll set it up later]  |
+----------------------------------------------+
```

- Integrated into the Campaign Builder review step, before the QA check
- Auto-detects the offer URL from the workspace and checks for the relevant event
- Platform-specific guides shown inline (reuses existing platform data from PixelVerificationCard)
- Users can skip but see a warning badge on the campaign

### 3. Quick Event Verifier (Reusable)
A lightweight "Verify my tracking" button that can appear:
- On each campaign card in the Results dashboard
- In the Campaign Builder review step
- In the Offer detail view

One tap: enters the URL, checks for the right event, shows pass/fail with guidance.

---

## Technical Details

### New Components

**`src/components/MetaReadinessChecklist.tsx`**
- Props: `brandId`, `onAllReady?: () => void`
- Fetches brand data (meta_account_id, page_id, instagram_account_id, meta_pixel_id)
- Calls `check-pixel-status` to verify pixel is active
- Renders 4-item checklist with status icons and plain-language help text
- Each incomplete item shows a contextual action (e.g., "Connect Meta" button for missing account, link to platform guide for missing pixel)

**`src/components/EventSetupAssistant.tsx`**
- Props: `brandId`, `offerUrl`, `campaignGoal: 'leads' | 'sales'`, `onStatusChange`, `onSkip`
- On mount, calls `verify-landing-page-pixel` with the offer URL
- Maps goal to required event: leads -> "Lead", sales -> "Purchase"
- Shows result in friendly language with platform-specific fix guides
- Includes "Copy code snippet" with the pre-filled pixel ID and correct event code
- "Skip for now" option that marks the campaign with a `tracking_verified: false` flag

### Modified Files

**`src/components/BrandOnboardingWizard.tsx`**
- After the existing 3 steps, if Meta is connected, show the MetaReadinessChecklist as a post-connection summary
- Non-blocking: users can proceed even with incomplete items, but get a clear picture of what's missing

**`src/pages/MetaSettings.tsx`**
- Add MetaReadinessChecklist card above the existing Pixel Verification card
- Replaces the need to mentally piece together connection status from multiple sections

**`src/components/MobileCampaignBuilder.tsx`**
- After the Budget step and before calling `onComplete`, if objective is "leads" or "sales":
  - Insert an EventSetupAssistant step using the workspace's offer URL
  - Step title: "Verify your tracking"
  - Can be skipped

**`src/components/QACheckScreen.tsx`**
- Add a tracking verification row to the QA checks that shows pass/warning/fail based on whether the event was verified
- If not verified, show inline "Check now" button that runs the verification

**`src/components/insights/InsightsHome.tsx`**
- On campaign cards where `tracking_verified === false` or no pixel events are detected, show a small warning badge: "Tracking not verified" with a link to verify

### Edge Function Changes
None required -- existing `check-pixel-status` and `verify-landing-page-pixel` functions already provide the data needed. The improvement is entirely on the UX/frontend side.

### Database Changes
- Add `tracking_verified` boolean column (default `false`) to `campaign_workspaces` table to track whether the user has confirmed event tracking for that campaign

### Key UX Principles
- One sentence per concept, no jargon
- "What does this mean?" expandable sections for curious users
- Platform logos (Shopify, WordPress, Kajabi) as visual selectors instead of text lists
- Pre-filled code snippets with the user's actual pixel ID
- Always allow skipping with a clear warning about consequences
- Green checkmarks provide dopamine hits as items get completed

