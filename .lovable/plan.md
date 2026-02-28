

## Plan: Revamp Sidebar Nav + Beef Up Start Page as Command Center

Two parts: sidebar label/link changes, and a major upgrade to `/start` as the prioritized "what needs attention" hub.

### 1. Sidebar Changes (`src/components/AppSidebar.tsx`)

**Rename/restructure `mainNav` and `toolsNav`:**
- Remove `/start` (Home) from mainNav entirely
- Rename "My Ads" → "Drafts" (`/campaigns`)
- Add new items to Tools group:
  - "Offers" → `/dashboard` (or a dedicated offers section — will route to My Brand's offers tab)
  - "Meta Connection" → `/settings` (Meta section)
  - "Troubleshooting" → `/glossary` (or a help/troubleshoot page)
- Keep Creative Studio, Results in Main

**Updated nav structure:**
```text
Main:
  - Drafts (/campaigns) — FolderKanban
  - Creative Studio (/creative-studio) — Sparkles
  - Results (/data) — BarChart3

Tools:
  - Library (/content-library) — Library
  - Offers (/dashboard?tab=offers) — Package
  - My Brand (/dashboard) — Building2
  - Meta Connection (/settings) — Link2
  - Troubleshooting (/glossary) — LifeBuoy

Account: (unchanged)
```

**"Next Steps" button** now always routes to `/start`.

### 2. Mobile Nav Updates
- `MobileBottomNav.tsx`: Rename "Home" → "Start Here", "My Ads" → "Drafts"
- `MobileHeader.tsx`: Update dropdown label "Home" → "Start Here"

### 3. Start Page Overhaul (`src/pages/Start.tsx`)

Transform from a centered card layout into a sectioned dashboard with prioritized attention items. Keep greeting + progress bar at top. Replace the generic "next steps" cards with organized sections:

**Section A: "Needs Attention" (priority alerts)**
- Rendered as a compact list of colored alert cards, sorted by priority
- Sources:
  - Meta disconnected or unhealthy → red/amber alert card with "Fix Meta Connection" CTA
  - Recommendations from Results that need user action (fetch `recCountsByWorkspace` summary) → amber card "X recommendations need review"
  - Draft campaigns in progress → card with count + "Continue" CTA
  - No offers yet → card prompting offer creation

**Section B: "Quick Actions" (always visible grid)**
- 2×2 grid of shortcut cards:
  - "Create New Ad" → `/create`
  - "View Results" → `/data`
  - "Manage Offers" → `/dashboard`
  - "Creative Studio" → `/creative-studio`

**Section C: "Your Setup" (status overview)**
- Keep existing status badges (Meta Connected, X offers, X ads) but expand into a small checklist-style section showing setup completion

**Data fetching additions:**
- Check Meta connection health (existing `activeBrand.meta_account_id`)
- Fetch recommendation counts from `campaign_workspaces` + the same logic used in InsightsHome for `recCountsByWorkspace`
- Fetch offer count, draft count (already done)
- Sort "Needs Attention" items: critical first (meta broken, critical recs), then medium (drafts to continue, attention recs), then low (suggestions)

**No new database tables needed** — all data already exists in `campaign_workspaces`, `offers`, and brand context.

### Files to change:
1. `src/components/AppSidebar.tsx` — restructure nav arrays, Next Steps → always `/start`
2. `src/components/MobileBottomNav.tsx` — rename labels
3. `src/components/MobileHeader.tsx` — rename "Home" to "Start Here"
4. `src/pages/Start.tsx` — full rewrite of the page body into sectioned command center

