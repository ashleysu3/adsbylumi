

# Revamp Onboarding, Navigation Dropdown, and Page Organization

## Overview

This plan addresses four interconnected issues: expanding the onboarding wizard, adding a "we/I" copy voice toggle, reorganizing brand-related pages for clarity (especially for agency users), and cleaning up the user dropdown menu.

## 1. Expand Onboarding Flow (`src/pages/Onboarding.tsx`)

The current onboarding is 3 steps: Brand Basics, Positioning Review, Meet Lumi. The new flow will be a guided, one-screen-per-step wizard with Meta connection last:

| Step | Content |
|------|---------|
| 1. Brand Basics | Name, Website URL (auto-extract), Industry |
| 2. Positioning | Value proposition, Target audience (pre-filled from extract) |
| 3. Copy Voice | "We/I" toggle + Emoji preferences (use emojis toggle, brand emoji picker, bullet style) |
| 4. Meet Lumi | Quick intro to Lumi (existing step 3) |
| 5. Connect Meta | Meta account connection (moved to last, skippable) |

- Step progress bar at top showing all 5 steps
- "Skip for now" option on step 5 (Meta) so users aren't blocked
- Copy voice toggle: simple card selection -- "We" (team/company voice) vs "I" (personal/solo voice) with preview text for each

## 2. Add `copy_perspective` Column to Brands Table

New database migration to add:

```sql
ALTER TABLE public.brands 
ADD COLUMN copy_perspective text NOT NULL DEFAULT 'I';
```

Values: `'I'` or `'We'`. Defaults to `'I'` since most users are solo coaches/creators.

## 3. Reorganize Dashboard Tabs and Pages

### Current confusion points:
- "My Brand" in dropdown goes to `/dashboard` which has Overview, Brand Brain, Offers tabs
- "Settings" has Account, Connections, Notifications, Alerts, Billing
- "Meta Connection" is a separate dropdown item going to `/meta-settings`
- Brand-specific settings (emojis, copy voice) live inside Dashboard > Brand Brain tab
- For agency users, it's unclear what's brand-specific vs account-level

### New organization:

**Dashboard page (`/dashboard`) -- rename to "My Brand"**
Tabs: Overview | Brand Brain | Offers | Brand Settings

- **Overview**: Brand details card (name, website, industry, positioning) -- same as now but WITHOUT the Meta account section (moved to Brand Settings)
- **Brand Brain**: Content assets, Audience psychology (same as now, but emoji/copy preferences REMOVED from here)
- **Offers**: Same as now
- **Brand Settings** (NEW tab): Emoji preferences, Copy voice (we/I), Meta connection -- all brand-specific config in one place

**Settings page (`/settings`) -- stays as account-level only**
Tabs: Account | Notifications | Alert Thresholds | Billing

- REMOVE "Connections" tab from Settings (Meta connection moves to Dashboard > Brand Settings)
- This page is purely account-level, not brand-specific

### Agency user clarity:
- Brand-specific settings (emojis, copy voice, Meta connection) live under `/dashboard` which switches per brand via BrandSelector
- Account settings (profile, notifications, billing) are global at `/settings`

## 4. Clean Up the Dropdown Menu

### Current dropdown (both desktop and mobile):
- Home
- My Brand
- Meta Connection
- Concept Library
- Settings
- Ads Glossary
- Show Walkthrough
- Sign Out

### New dropdown structure:

```
[User name + email]
---
Home
My Brand           (goes to /dashboard)
Concept Library    (goes to /content-library)
---
Settings           (goes to /settings -- account-level)
Ads Glossary       (goes to /glossary)
---
Sign Out
```

Changes:
- REMOVE "Meta Connection" as a standalone item (now accessible via My Brand > Brand Settings tab)
- REMOVE "Show Walkthrough" (rarely used, clutters menu)
- Group items with separators: primary nav, then secondary, then sign out
- Cleaner, fewer items, less cognitive load

## Files Changed

| File | Change |
|------|--------|
| **Database migration** | Add `copy_perspective` column to brands table |
| `src/pages/Onboarding.tsx` | Expand to 5-step wizard: add copy voice step + emoji step + Meta connection as final step |
| `src/pages/Dashboard.tsx` | Add "Brand Settings" tab with emoji prefs, copy voice toggle, Meta connection. Remove emojis from Brand Brain tab. Remove Meta from Overview tab. |
| `src/pages/Settings.tsx` | Remove "Connections" tab |
| `src/components/DashboardLayout.tsx` | Clean up desktop dropdown menu |
| `src/components/MobileHeader.tsx` | Clean up mobile dropdown menu |

## Technical Details

### Copy Voice Toggle Component
A simple two-card selector with preview text:

```tsx
// "I" option
"I help entrepreneurs scale their business..."
"My program teaches you..."

// "We" option  
"We help entrepreneurs scale their business..."
"Our program teaches you..."
```

Stored as `copy_perspective: 'I' | 'We'` on the brands table. Used by edge functions (generate-angle-copy, generate-creative-grid, etc.) when generating ad copy.

### Onboarding Step 3 (Copy Voice + Emojis)
Combines the copy perspective selector and emoji preferences into a single "Your Copy Style" step. This consolidation means users set their preferences upfront rather than discovering these settings later in the Brand Brain tab.

### Onboarding Step 5 (Meta Connection)
Reuses the existing `MetaAccountConnect` component. Includes a prominent "Skip for now" button and a note: "You can always connect later from your Brand Settings."

### Edge Function Updates
The `copy_perspective` value needs to be passed to copy-generating edge functions. The existing `brand_voice` field already flows through -- `copy_perspective` will be added alongside it in the same data payloads in `CreativeStudio.tsx`, `Creative.tsx`, and `AdCopyLibrary.tsx`.

