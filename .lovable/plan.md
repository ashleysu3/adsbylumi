

## Updated Plan: Replace "New Ad" with Smart "Next Steps" Button in Sidebar

This modifies the approved sidebar plan. Instead of a prominent "New Ad" gradient button at the top of the sidebar, add a "Next Steps" button that routes intelligently.

### Logic
- If user has active campaigns with performance data → navigate to `/data` (Results page)
- If user has no campaigns or no results → navigate to `/start` (Home, which has offer/ad creation flows)

### Implementation

#### In `src/components/AppSidebar.tsx` (when created)
- Replace the "New Ad" gradient pill with a "Next Steps" pill using the same Lumi gradient styling
- Icon: `ArrowRight` or `Zap` instead of `Sparkles`
- On click: check if user has any campaigns with metrics (query `campaigns` or check a lightweight flag from context), then route accordingly
- The "New Ad" action is still accessible from: the Home page cards, the My Ads page, and the Library — so removing it from the sidebar loses nothing critical

#### Routing logic (lightweight)
- Use existing brand context or a quick Supabase query for `campaign_workspaces` count
- If count > 0 → `/data`
- If count === 0 → `/start`

No other changes to the sidebar plan. Everything else (nav groups, Ask Lumi, collapse behavior, mobile untouched) stays the same.

