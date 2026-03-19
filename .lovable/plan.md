

## Ads Manager Dashboard for LUMI

This is a large feature. The app already has foundational pieces (brands, campaigns, optimization_reports, ad_action_log, weekly_reports, campaign_goals, pending_optimizations). The plan builds on these existing tables and adds the missing agency-level management layer.

### What Already Exists (Reuse)
- `brands` table = clients (name, meta_account_id, etc.)
- `campaign_workspaces` = campaigns with objectives, budgets, KPIs
- `campaign_goals` = KPI targets per campaign
- `ad_action_log` = audit log of all changes
- `optimization_reports` = performance reports
- `pending_optimizations` = approval workflow
- `weekly_reports` = weekly report storage
- `ActionHistoryTimeline` component = audit log UI

### What's New

**1. Database Changes (2 new tables, 1 alter)**

| Table | Purpose |
|-------|---------|
| `agency_clients` | Extends brands with Slack channel IDs, contact info, health status, notes — the "scorecard" metadata |
| `review_logs` | Structured review entries tied to a date, with campaign metrics, ad-level data, action plans, and approval status |
| ALTER `brands` | Add `last_review_date` and `next_report_due` columns |

**2. New Pages**

| Route | Component | Purpose |
|-------|-----------|---------|
| `/ads-manager` | `AdsManager.tsx` | Health overview dashboard — all clients at a glance with status pills, last review, flagged items |
| `/ads-manager/client/:id` | `AdsManagerClient.tsx` | Client scorecard + campaign list with KPI targets, status badges, notes |
| `/ads-manager/review` | `AdsManagerReview.tsx` | Mon/Thu optimization review flow — input metrics, flag ads, generate action plans |
| `/ads-manager/approve` | `AdsManagerApprove.tsx` | Approval queue — summary of proposed actions, approve/reject per client or action |
| `/ads-manager/reports` | `AdsManagerReports.tsx` | Tuesday report workflow — draft/approve/send cycle with preview |

**3. New Components**

| Component | Purpose |
|-----------|---------|
| `ClientScorecard` | Collapsible card showing client health, campaigns, KPIs, status indicators |
| `ReviewForm` | Structured form for entering 3-day/7-day metrics, ad-level spend/CPL/ROAS, flagging ads |
| `ApprovalQueue` | List of pending actions grouped by client with approve/reject buttons |
| `ReportDraftPreview` | Report preview with KPI status emojis, budget summaries, editable notes |
| `ClientHealthBadge` | Color-coded status pill (green/yellow/red) |

**4. Sidebar Addition**

Add "Ads Manager" section to `AppSidebar.tsx` (visible for agency users or admins) with sub-items: Overview, Reviews, Approvals, Reports.

**5. Edge Functions**

| Function | Purpose |
|----------|---------|
| `generate-review-action-plan` | Takes review metrics + KPI targets, generates AI action plan summary |
| `generate-manager-report` | Auto-generates Tuesday report draft from latest review log data |

**6. Audit Log Enhancement**

Extend `ActionHistoryTimeline` to support filtering by client and action type. Add an "Audit Log" tab to the Ads Manager dashboard that shows all changes across all clients.

### Data Model Details

```text
agency_clients
├── id (uuid, PK)
├── brand_id (uuid, FK → brands)
├── slack_client_channel (text)
├── slack_internal_channel (text)
├── contact_name (text)
├── contact_email (text)
├── health_status (text: healthy/watching/needs_attention/paused)
├── notes (text)
├── created_at, updated_at

review_logs
├── id (uuid, PK)
├── brand_id (uuid, FK → brands)
├── review_date (date)
├── reviewer_id (uuid, FK → auth.users via profiles)
├── campaign_metrics (jsonb) — per-campaign 3d/7d actuals
├── ad_level_data (jsonb) — per-ad spend/CPL/ROAS/flags
├── action_plan (text) — AI-generated or manual summary
├── approval_status (text: draft/pending/approved/executed)
├── approved_by (uuid)
├── approved_at (timestamptz)
├── notes (text)
├── created_at
```

### UI Design Approach

- Data-forward: table-based layouts with inline editing
- Color coding: green (`bg-green-500/10`), yellow (`bg-amber-500/10`), red (`bg-destructive/10`) throughout
- Collapsible client sections using existing `Collapsible` component
- Mobile-friendly: stacked cards on small screens, scrollable tables on desktop
- Status system: ✅ On Track, ⚠️ Watching, 🔴 Needs Intervention, ⏸️ Paused, 🚫 Turned Off

### Files Changed

| File | Change |
|------|--------|
| **New migration** | Create `agency_clients`, `review_logs` tables with RLS |
| `src/pages/AdsManager.tsx` | Health overview dashboard |
| `src/pages/AdsManagerClient.tsx` | Client scorecard detail |
| `src/pages/AdsManagerReview.tsx` | Review flow UI |
| `src/pages/AdsManagerApprove.tsx` | Approval workflow |
| `src/pages/AdsManagerReports.tsx` | Report draft/approve/send |
| `src/components/ads-manager/ClientScorecard.tsx` | Scorecard component |
| `src/components/ads-manager/ReviewForm.tsx` | Review entry form |
| `src/components/ads-manager/ApprovalQueue.tsx` | Approval queue |
| `src/components/ads-manager/ReportDraftPreview.tsx` | Report preview |
| `src/components/ads-manager/ClientHealthBadge.tsx` | Status badge |
| `src/components/AppSidebar.tsx` | Add Ads Manager nav section |
| `src/App.tsx` | Add new routes |
| `supabase/functions/generate-review-action-plan/index.ts` | AI action plan generation |
| `supabase/functions/generate-manager-report/index.ts` | Auto-generate report drafts |
| `src/components/insights/ActionHistoryTimeline.tsx` | Add client/action-type filters |

