# Quiet down the sidebar folders

## What's actually wrong

The four folders — Creative, My Brand, Agency, Help & Settings — are styled as full-width gradient pills with uppercase letter-spaced type, generous padding, and a gap between each one. That gives them the exact visual weight of the two primary buttons (Create New, My Ads), so the eye reads six equal buttons instead of "two actions + some drawers." They also eat about half the sidebar height while showing zero actual destinations.

## The fix

Make the folder headers read as section labels, not buttons:

- Remove the gradient pill background. Use plain muted text with a hover tint only.
- Drop the type down to a small uppercase label (11px, muted foreground), keeping the chevron on the right.
- Tighten vertical rhythm: remove the per-group spacing so the four folders stack as a compact list instead of four separated blocks.
- Keep the active-group auto-expand behavior and the active-item highlight exactly as they are — when a folder is open, its children keep today's styling so the open section still feels substantial.
- Add a thin separator above the folder stack so the two primary buttons clearly own the top zone.

Net effect: the top of the sidebar is search + two colored actions, and everything under it recedes into a quiet navigation list that expands on demand.

## Technical notes

Single file: `src/components/AppSidebar.tsx`.

- `SidebarGroupLabel` className in the `allGroups.map(...)` block: swap the `bg-gradient-to-r from-lumi-orange-1/15 ...` classes for `text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50`, reduce to `text-[11px] tracking-[0.1em]`, and tighten padding/margins (`py-1 my-0`).
- Wrap the group list in a container with tight spacing, and give each `SidebarGroup` `py-0` so the four rows sit close together.
- No changes to items, routing, collapsed mode, or the footer.
