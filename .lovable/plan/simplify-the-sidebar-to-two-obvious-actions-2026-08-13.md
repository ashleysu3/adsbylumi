# Simplify the sidebar to two obvious actions

Agreed with the direction. Two primary buttons, everything else quieter and below. Tasks stop being a nav destination and live on Home, which is where the logo and login both land.

## New sidebar order

```text
[ LUMI logo ]        <- clicking it goes Home (tasks live there)
[ brand selector ][bell]
[ How can LUMI help today? ]

[  + Create New   ]   <- primary gradient button (where "My Tasks" is now)
[  ~ My Ads       ]   <- secondary, outlined in an accent color

Admin Dashboard / Partner Dashboard / VIP (unchanged, only when they apply)

MY BRAND        v
CREATIVE        v
AGENCY          v
HELP & SETTINGS v
```

## What changes

1. **Create New** becomes the top gradient button, replacing the "My Tasks" button. Same visual weight it has today.
2. **My Ads** sits directly under it as a clearly paired but visually distinct button — accent border and tinted background rather than the full gradient, so the pair reads as "make something" / "check on it".
3. **Home, Create New, and My Ads leave the flat nav list**, since Create New and My Ads are now the buttons and Home is the logo. This removes the duplicate rows.
4. **The LUMI logo** already routes to `/home`; it stays and gets a hover/pointer cue so it's clearly clickable. Login already lands on Home.
5. **Tasks** are reachable from Home (it already lists open tasks) and from the existing task bell. The `/tasks` page stays live so old links keep working — it just isn't a sidebar item anymore.
6. **Collapsed sidebar**: both buttons shrink to their icons (plus and activity) with tooltips, so the two main actions stay reachable in icon mode.

## Optional (say the word)

Show a small count badge on the logo or Home area when the user has open tasks, so tasks aren't out of sight for people who had a habit of clicking "My Tasks".

## Technical notes

- Only `src/components/AppSidebar.tsx` changes: remove Home / Create New / My Ads from `topActions` (the array becomes empty and gets deleted), and replace the "My Tasks" button block in `SidebarHeader` with the two new buttons.
- Buttons use existing tokens (`lumi-orange-1 / lumi-pink-1 / lumi-purple-1` gradient for Create New, accent border + tint for My Ads) — no new colors.
- No routing changes; `/tasks`, `/home`, `/create`, `/my-ads` all stay as they are.
