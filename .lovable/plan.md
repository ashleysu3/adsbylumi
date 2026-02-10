

# Creative Studio "TV Open" Overlay with Calming Layout

## Overview

Instead of navigating to a separate full-page route, the Creative Studio will open as an animated overlay panel that expands from the center (like an old CRT TV powering on) while keeping the top header bar (logo, brand selector, New Ad button, avatar) visible. The tab navigation disappears behind the overlay, creating a focused creative workspace that still feels connected to the main app.

## The Animation Concept

When the user clicks "CREATIVE STUDIO" in the tab bar:
1. A small circle appears at the center of the content area
2. It rapidly expands outward (clip-path circle animation) revealing the Creative Studio content
3. The tab bar slides away or gets covered by the overlay
4. The top header (logo, monogram, New Ad) stays visible and functional
5. A close/back button lets users collapse the studio back down

This uses CSS `clip-path: circle()` animated via framer-motion for the iris/TV effect.

## Architecture Change

Currently, `/creative-studio` is a standalone route with its own layout. The new approach:

- **Keep the route** (`/creative-studio`) so direct links still work
- **Wrap CreativeStudio in DashboardLayout** so the header stays visible
- **Add an iris-open animation** that plays when the page mounts
- **Hide the tab nav bar** when on the `/creative-studio` route (the overlay covers it)
- **Replace the Creative Studio's own sticky header** with a slimmer toolbar since the main header is already showing

## Visual and Spacing Improvements

The Creative Studio interior will be refined for a calming, spacious feel:

- Increase vertical padding between sections (py-8 instead of py-6)
- Add more horizontal margin on the content area (max-w-6xl instead of max-w-7xl for breathing room)
- Soften card backgrounds with subtle gradients
- Increase spacing between workflow tabs and content (mb-8 instead of mb-6)
- Use softer borders and rounded-2xl on cards
- Add a gentle background gradient to the overlay panel

## Files Changed

| File | Change |
|------|--------|
| `src/components/DashboardLayout.tsx` | Hide tab nav bar when on `/creative-studio` route; render children normally so header stays |
| `src/pages/CreativeStudio.tsx` | Wrap in DashboardLayout; remove the duplicate sticky header (back button, title, brand name); add iris-open animation wrapper; improve spacing and whitespace throughout |
| `src/index.css` | Add `@keyframes iris-open` clip-path animation |

## Technical Details

### DashboardLayout Changes

When `location.pathname === '/creative-studio'`, the tab navigation section (`<nav>` with the tab items) will be hidden. The header row (logo, brand selector, New Ad, avatar, Lumi button) stays visible. This is a simple conditional render.

### Iris Animation (CreativeStudio.tsx)

The Creative Studio content will be wrapped in a framer-motion `div` with a clip-path animation:

```tsx
<motion.div
  initial={{ clipPath: "circle(0% at 50% 50%)" }}
  animate={{ clipPath: "circle(150% at 50% 50%)" }}
  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
  className="min-h-[calc(100vh-80px)] bg-background"
>
  {/* Creative Studio content */}
</motion.div>
```

This creates the old-TV iris effect -- content reveals from a tiny circle in the center expanding outward.

### CreativeStudio Layout Cleanup

Since the main header is now provided by DashboardLayout:

- Remove the duplicate sticky top bar (the one with ArrowLeft, "Creative Studio" title, brand name, workspace selector)
- Move the workspace selector and primary action button into a slimmer inline toolbar at the top of the content area
- Add a close/back button that navigates to `/campaigns`

### Spacing and Calming Design Updates

- Content max-width: `max-w-6xl` (narrower than current 7xl for more side breathing room)
- Section spacing: `space-y-8` (up from space-y-6)
- Tab list bottom margin: `mb-8` (up from mb-6)
- Card padding: `p-6` consistently
- Card border radius: `rounded-2xl`
- Subtle background: light gradient or very faint warm tint behind the content area
- Workflow tab pills: slightly larger with more padding for easier clicking
- Empty state cards: more generous padding (py-16 instead of py-12)
