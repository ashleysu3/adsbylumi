# Navigation: three options

The sidebar is now almost empty. All that's left in the main body is one collapsible folder ("Creative") with two divider lines above it, while the real work — Ad Dashboard, Create, Tasks, Account — already lives in the header and footer. A sidebar exists to hold many destinations. We no longer have many destinations. That's why it looks off.

Today's inventory:

```text
Header   logo · brand selector · bell · LUMI search · Admin · My Tasks · (Partner) · (VIP)
Body     Creative folder (Inspiration, The Lab, My Creatives, Tools)
Footer   Account settings cog (My Brand, Agency, Help & Settings, Billing, Refer) · loving LUMI
```

Note: mobile already uses a top header plus a bottom nav, so a top bar on desktop would make both form factors behave the same way.

---

## Option A — Keep the sidebar, delete the leftovers

Remove the two rules above "Creative" and un-collapse the folder so its four items sit as plain rows under a single quiet label. Add "The Studio" (renamed **Ad Dashboard**) and "Create a new ad" back as two visible rows at the top.

Pros
- Smallest change, zero risk to routing or mobile.
- Fixes the visual weirdness immediately.

Cons
- Still spends ~260px of permanent screen width on five links.
- Doesn't solve the underlying problem: the app has one real destination and the sidebar keeps implying there are many.

## Option B — Top bar + hamburger (the attached reference)

Retire the desktop sidebar. A single top bar holds: LUMI logo (home), brand selector, the LUMI search field, a **Create a new ad** button, notifications bell, and a hamburger on the right that opens a full panel containing Creative, My Brand, Agency, Help & Settings, Billing, Refer, Admin. `/studio` becomes the **Ad Dashboard** and is the default landing page.

Pros
- Full page width for the dashboard — the cards, charts and campaign rows get room to breathe, which is what makes the reference screenshot feel calm and premium.
- One obvious primary action in the bar; everything secondary is behind one predictable door. Less to scan = less overwhelm.
- Matches the mobile pattern already in the app, so there is one mental model.

Cons
- Everything except Create sits behind a hamburger, so Creative pages become two clicks instead of one. Non-techy users don't always spot a hamburger.
- The biggest build of the three: new shell component, tour/walkthrough anchors and any `data-tour` selectors pointing at sidebar elements need re-pointing.

## Option C — Top bar with visible tabs, no hamburger (recommended)

Same top bar as B, but instead of hiding everything, the bar shows three or four named destinations as tabs and the cog holds only account/support:

```text
[LUMI]  Ad Dashboard  Creative  My Tasks   [ ask LUMI... ]   [+ Create a new ad]  [bell] [cog]
```

Creative opens a small dropdown with its four pages. The cog holds My Brand, Agency, Help & Settings, Billing, Refer, Admin. Nothing is hidden behind an unlabeled icon.

Pros
- Full page width like B, but the destinations stay named and one click away — for a non-techy user, visible words beat a hamburger every time.
- Clear hierarchy: dashboard is home, one gradient Create button is the dopamine action, admin/settings stay quiet.
- Room for the reward moments (streaks, "your ad is live" badges, render bell) right in the bar where they're always visible.

Cons
- Slightly more crowded bar than B on narrow laptops; needs a breakpoint where Creative collapses into the cog.
- Same migration cost as B for tour anchors.

---

## Recommendation

Option C. It gets the calm, wide, dashboard-first feel of the attached reference without asking an overwhelmed user to hunt inside a hamburger.

## What building Option C involves

1. New `AppTopBar` component: logo (→ Ad Dashboard), brand selector, tab links, IntentBar, gradient **Create a new ad** button, render bell, cog dropdown.
2. `DashboardLayout` renders `AppTopBar` on desktop instead of `SidebarProvider`/`AppSidebar`; mobile header and bottom nav are untouched.
3. Rename "The Studio" to **Ad Dashboard** in nav labels and on the `/studio` page heading. Route path stays `/studio` so existing links and bookmarks keep working.
4. Re-point guided tour / walkthrough selectors that currently target sidebar elements, and update `setDesktopNavLayout` so the LUMI assistant knows the new layout.
5. Below ~1100px the Creative tab folds into the cog menu; below the mobile breakpoint nothing changes.
6. Retire `AppSidebar` once nothing renders it.
