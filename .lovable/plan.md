

# Creative Lifecycle Manager: Auto-Refresh, Bench System, and Performance Intelligence

## Overview

This feature transforms Lumi from a "create once and launch" tool into an ongoing creative management system. It introduces a **Published vs. Bench** organization for creative assets, automatic fatigue detection with smart rotation, performance feedback on top creative, trend-informed suggestions, batch creative refresh sessions, and intelligent ad retesting.

## What You Will Get

1. **Published vs. Bench organization** -- Every campaign workspace organizes its creative into "Live" (currently running in Meta) and "On the Bench" (approved and ready to swap in when needed)
2. **Automatic fatigue detection** -- Lumi checks your ad metrics daily and flags when creative is getting stale (high frequency, dropping CTR)
3. **Smart creative rotation** -- When fatigue is detected, Lumi either auto-swaps bench creative in (if you opted in) or emails you asking permission first
4. **Best performer feedback** -- A "What's Working" card on the Results dashboard showing your top creative and why it's performing, plus suggestions based on what's working for similar businesses
5. **Batch creative refresh** -- A "Refresh Creative" flow that lets you generate a new batch of creative concepts for an existing campaign, pre-loaded with what's been working
6. **Ad retesting** -- Lumi can automatically re-enable previously paused ads that performed well, especially when the bench runs dry (with a configurable cooldown period)

---

## Technical Details

### Phase 1: Database Schema

**New table: `creative_bench`**

Tracks each creative asset's lifecycle status within a campaign workspace.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| brand_id | uuid FK | Brand isolation |
| workspace_id | uuid FK | Links to campaign_workspaces |
| production_item_id | text | Reference to production item |
| meta_ad_id | text | Meta ad ID once published |
| status | text | `live`, `bench`, `paused`, `retired`, `retesting` |
| performance_snapshot | jsonb | Last known CTR, CPC, ROAS, frequency |
| auto_rotate_approved | boolean | User pre-approved this asset for auto-swap |
| paused_at | timestamptz | When it was paused |
| last_live_at | timestamptz | Last time it ran |
| retest_eligible_at | timestamptz | Earliest date for retesting |
| created_at | timestamptz | |

RLS: Brand ownership check via `brands` join.

**New table: `creative_rotation_log`**

Audit trail for every rotation event.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| workspace_id | uuid FK | |
| brand_id | uuid FK | |
| action | text | `swap_in`, `pause_fatigue`, `retest`, `user_approved`, `auto_rotated`, `retired` |
| old_ad_id | text | Ad being paused |
| new_ad_id | text | Ad being activated |
| reason | text | Human-readable explanation |
| created_at | timestamptz | |

RLS: Brand ownership check.

**Add columns to `campaign_workspaces`:**
- `auto_rotate_enabled` (boolean, default false) -- opt-in to auto-rotation
- `rotation_preferences` (jsonb) -- fatigue thresholds and retest rules

### Phase 2: Edge Functions

**`check-creative-fatigue`** (new, scheduled daily via pg_cron at 9 AM UTC)

For each brand with a connected Meta account and live campaigns:
1. Fetch ad-level insights (CTR, frequency, spend) for the last 7 days
2. Detect fatigue: frequency >= 4 AND CTR dropped 25%+ from initial period
3. Detect underperformers: CTR < 0.8% AND reach >= 1,000 AND running >= 3 days
4. Check `creative_bench` for available bench creative
5. Decision logic:
   - Auto-rotate ON + bench available: pause fatigued ad, activate bench ad via Meta API, log event, send confirmation email + Slack notification
   - Auto-rotate OFF + bench available: send approval email with one-click approve link
   - No bench available: check for retest-eligible paused ads (good historical metrics, paused >= 14 days), or suggest a Creative Refresh session
6. Update `creative_bench` statuses and log to `creative_rotation_log`

**`rotate-creative`** (new, called on-demand or by fatigue checker)

Executes a creative swap:
1. Pause the fatigued ad via Meta API
2. Activate bench ad (create new ad in existing ad set or un-pause)
3. Update `creative_bench` statuses
4. Log to `creative_rotation_log`
5. Send Slack notification to `#lumi-alerts`

**`generate-trend-insights`** (new, called on-demand from UI)

1. Pull brand's industry, audience profile, and top-performing creative patterns from the database
2. Use AI (Gemini Flash) to generate:
   - "What's working NOW" for their industry/audience type
   - Current creative format trends (hooks, visual styles, formats)
   - Specific suggestions tailored to their brand voice and audience psychology
3. Return structured JSON with trend cards

### Phase 3: UI Components

**Creative Bench Panel** (`src/components/insights/CreativeBenchPanel.tsx`)

Added to the campaign detail view in the Results dashboard:
- Two sections: "Live" ads with mini performance indicators, "On the Bench" ads ready to swap in
- Quick toggle for "Auto-rotate when fatigued"
- "Swap Now" button for manual rotation
- Rotation history log (collapsible)

**"What's Working" Card** (`src/components/insights/WhatsWorkingCard.tsx`)

New card on the Results dashboard home:
- Top 3 performing ads with performance summary
- AI-generated "Why it works" explanation
- Industry trend suggestions
- "Create more like this" button that opens Creative Studio pre-loaded with the winning pattern

**Creative Refresh Prompt** (`src/components/insights/CreativeRefreshPrompt.tsx`)

Alert banner shown when fatigue is detected:
- Shows which ads are fatiguing and why
- "Refresh Creative" CTA that opens Creative Studio with performance context pre-loaded
- "Approve Swap" button if bench creative is available

### Phase 4: Settings Integration

Add a "Creative Automation" section to the Settings page (new tab or within existing Notifications tab):
- Toggle: "Auto-rotate creative when fatigue is detected"
- Fatigue frequency threshold (default: 4)
- Toggle: "Auto-retest paused ads when bench is empty"
- Retest cooldown period (default: 14 days)

### Phase 5: Creative Studio Refresh Mode

Update `CreativeStudio.tsx` to support a "refresh" mode:
- When opened via "Refresh Creative" from the Results dashboard, pre-load with:
  - Performance data from the current campaign (what worked, what didn't)
  - AI trend insights for their industry
  - Existing angles and concepts as reference
- New concepts generated in refresh mode go to the Bench automatically
- Standard production workflow applies for the new batch

### Phase 6: Daily Digest Enhancement

Update `slack-daily-digest` to include:
- Creative fatigue alerts across all brands
- Auto-rotations that occurred in the last 24 hours
- Campaigns running low on bench creative (0-1 bench items remaining)

---

## Files to Create

- `supabase/functions/check-creative-fatigue/index.ts` -- Daily fatigue detection + auto-rotation trigger
- `supabase/functions/rotate-creative/index.ts` -- Execute creative swap via Meta API
- `supabase/functions/generate-trend-insights/index.ts` -- AI-powered trend analysis
- `src/components/insights/CreativeBenchPanel.tsx` -- Bench management UI
- `src/components/insights/WhatsWorkingCard.tsx` -- Top performer + trends card
- `src/components/insights/CreativeRefreshPrompt.tsx` -- Fatigue alert with refresh CTA

## Files to Modify

- `src/pages/Data.tsx` -- Add Creative Bench panel and What's Working card
- `src/components/insights/CampaignInsightDetail.tsx` -- Add bench status and rotation controls per campaign
- `src/pages/Settings.tsx` -- Add Creative Automation settings section
- `src/pages/CreativeStudio.tsx` -- Support "refresh" mode with performance context
- `supabase/functions/slack-daily-digest/index.ts` -- Add fatigue + rotation summary

## Database Migrations

1. Create `creative_bench` table with RLS policies (brand ownership)
2. Create `creative_rotation_log` table with RLS policies (brand ownership)
3. Add `auto_rotate_enabled` and `rotation_preferences` columns to `campaign_workspaces`
4. Schedule `check-creative-fatigue` via pg_cron (daily at 9 AM UTC)

## Implementation Order

1. Database migrations (tables + columns)
2. Edge functions (`rotate-creative` first, then `check-creative-fatigue`, then `generate-trend-insights`)
3. UI components (CreativeBenchPanel, WhatsWorkingCard, CreativeRefreshPrompt)
4. Page integrations (Data.tsx, CampaignInsightDetail.tsx, Settings.tsx)
5. Creative Studio refresh mode
6. Daily digest update
7. pg_cron scheduling

