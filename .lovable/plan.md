# The Studio — one home page, one task tray

Collapse "Create a New Ad" and "See My Ads" out of the sidebar. The ads page becomes **The Studio** — the page everyone lands on — and LUMI's recommended tasks move into a draggable slide-out tray that's available everywhere.

## 1. The Studio (replaces /my-ads and /home)

- Rename the page to **The Studio** with a short subhead ("Everything you're running, and everything you're building").
- Header row: brand context on the left, one big gradient **Create a new ad** button on the right (same style as the current sidebar primary button).
- Keep the existing content and behavior underneath: Meta import banner, **Live** section (performance engine), **In progress** section (drafts + resume banner), and the collapsed/expanded preferences that already persist per user.
- Keep the `?addCreative=true` focused picker mode as-is.
- Empty state: when there's nothing live and nothing in progress, show a single centered "Make your first ad" panel instead of two empty accordions.
- Routing: `/studio` becomes the canonical path. `/my-ads`, `/home`, `/campaigns`, and the existing legacy aliases all redirect there. Post-login and post-onboarding redirects point at `/studio`.

## 2. Sidebar cleanup

- Remove the "Create a New Ad" and "See My Ads" buttons.
- The LUMI logo continues to go to the home page (now The Studio).
- The intent bar stays at the top; a small **Tasks** button sits under it to pop the tray open.
- Creative / account cog groups stay exactly as they are.

## 3. Slide-out task tray

A new floating tray, mounted app-wide in the dashboard layout:

- A small gradient tab button pinned to a screen edge, with the open task count on it.
- Clicking it slides a panel out from that edge; clicking the tab again or the backdrop closes it.
- The tab is **draggable** — drag it to any edge (left/right) and anywhere vertically. Position is saved per user in localStorage so it stays where they put it.
- Contents: LUMI's recommended tasks (with the existing High/Medium/Low impact badges) plus the user's own tasks, using the same `useTasks` hook — complete, snooze, delete, add a task, and the "go do it" link all work as they do today.
- Filter chips for Open / Snoozed / Done, matching the current page.
- The standalone `/tasks` page is retired and redirects into The Studio with the tray auto-opened.

## Technical notes

- New `src/components/TaskTray.tsx` (tab + panel + drag logic) and `src/components/tasks/TaskRow.tsx` extracted from `src/pages/Tasks.tsx` so both surfaces share one row renderer; tray is mounted in `DashboardLayout`.
- `src/pages/MyAds.tsx` renamed to `src/pages/Studio.tsx`; localStorage prefs key kept so existing users don't lose their section state.
- Route table in `src/App.tsx`: add `/studio`, convert `/my-ads`, `/home`, `/campaigns`, `/tasks` to redirects, and repoint any in-app `navigate("/my-ads")` / `navigate("/home")` calls.
- Drag state stored as `{ edge: "left" | "right", topPct: number }` under a user-scoped key.
- No database, edge function, or data-model changes.
