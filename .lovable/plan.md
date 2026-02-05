

# UI Refinements: Replace "AI" with "Smart", Reposition Notifications & Lumi Chat

## Overview

This plan implements three user-requested changes:
1. Replace all user-facing "AI" text with "smart" (or contextually appropriate variants)
2. Move toast notifications to top-center of the screen
3. Reposition the Lumi chat bubble to sit in the navigation row on desktop (far right, same level as tabs)

---

## Part 1: Replace "AI" with "Smart"

### Files to Update

The search identified ~30 locations where "AI" appears in user-facing UI text. Each will be updated with contextually appropriate replacements:

| Original Text | Replacement |
|---------------|-------------|
| "AI-powered" | "Smart" |
| "AI-generated" | "Smart-generated" |
| "AI will" | "Lumi will" or "Smart" |
| "AI copy" | "Smart copy" |
| "AI insights" | "Smart insights" |
| "AI credits" | "Credits" |
| "AI Copywriting" | "Smart Copywriting" |
| "Your AI Assistant" | "Your Ad Assistant" |
| "AI-driven" | "Smart" |

### Files to Modify

1. **index.html** - Meta descriptions
2. **src/components/BrandOnboardingWizard.tsx** - "AI-driven campaigns"
3. **src/components/CopyEditor.tsx** - "AI copy generated", "AI Insights"
4. **src/pages/Start.tsx** - "Our AI will help you", "with AI insights"
5. **src/components/DashboardLayout.tsx** - Multiple walkthrough descriptions
6. **src/components/AdsEmptyState.tsx** - "AI-powered wizard", "AI Copywriting"
7. **src/pages/Dashboard.tsx** - "AI-generated ad copy", "AI-powered creative"
8. **src/pages/Settings.tsx** - "AI-powered ad creation"
9. **src/pages/Data.tsx** - "AI-powered optimization", "AI recommendations"
10. **src/pages/CreativeStudio.tsx** - "AI-powered creative angle"
11. **src/components/creative/ProductionManager.tsx** - "AI will rank"
12. **src/pages/Planning.tsx** - "AI-generated ad scripts"
13. **src/pages/Index.tsx** - "AI-powered strategy"
14. **src/pages/Pricing.tsx** - "AI-powered strategy"
15. **src/pages/Onboarding.tsx** - "AI-powered Meta Ads"
16. **src/components/MobileOnboardingTour.tsx** - "AI-powered scripts"
17. **src/components/LumiAssistant.tsx** - "Your AI Assistant" → "Your Ad Assistant"
18. **supabase/functions/finalize-ad-copy/index.ts** - Error message
19. **supabase/functions/generate-copy-variations/index.ts** - Error message

---

## Part 2: Move Notifications to Top-Center

### Current Behavior
The Sonner toast component (via `src/components/ui/sonner.tsx`) defaults to bottom-right positioning.

### Solution
Add the `position` prop to the Sonner Toaster component to move notifications to the top-center of the screen.

### File to Modify: `src/components/ui/sonner.tsx`

```typescript
return (
  <Sonner
    theme={theme as ToasterProps["theme"]}
    position="top-center"  // ADD THIS
    className="toaster group"
    // ...rest
  />
);
```

This single change moves all toast notifications to the top-center, avoiding overlap with the bottom navigation on mobile and the Lumi chat button.

---

## Part 3: Reposition Lumi Chat to Navigation Row

### Current Behavior
- The Lumi chat button is a floating element positioned at the bottom-right corner
- On mobile: `bottom-24 right-4` (above bottom nav)
- On desktop: `bottom-6 right-6`

### New Behavior
- **Desktop**: Lumi chat bubble sits in the header navigation row, far right, on the same visual level as the tabs (Home, My Ads, Creative Studio, Results)
- **Mobile**: Keep current floating behavior (bottom-right above nav) since there's no horizontal space in mobile nav

### Implementation Approach

The Lumi chat button is rendered via `LumiAssistantUI` inside `LumiAssistantProvider` which wraps the entire app. To position it within the desktop header navigation, we need to:

1. **Create a portal target** in `DashboardLayout.tsx` for the desktop Lumi button
2. **Conditionally render** the Lumi button:
   - Desktop: Render inline in the navigation header (far right of tabs row)
   - Mobile: Keep floating behavior (current position)
3. **Update `LumiAssistantUI`** to detect desktop layout and render via portal

### Alternative (Simpler) Approach

Instead of complex portal logic, we can:
1. Add the Lumi chat trigger button directly into `DashboardLayout.tsx` desktop nav
2. The `LumiAssistantUI` component continues to handle the chat popup/modal
3. Expose a method to open the chat from outside

### Files to Modify

**`src/components/DashboardLayout.tsx`**:
- Add a Lumi button in the desktop navigation row (far right after tabs)
- Style it as a floating bubble aesthetic but inline with nav

**`src/components/LumiAssistant.tsx`**:
- Export a way to control chat open state from context
- Conditionally hide the floating button on desktop (when inside DashboardLayout)
- On mobile, keep the floating button as-is

**`src/components/MobileBottomNav.tsx`**:
- No changes needed (mobile keeps current behavior)

### Desktop Nav Layout Change

```text
┌─────────────────────────────────────────────────────────────────┐
│ [LOGO]  [Brand Selector]                    [Library] [New Ad] [Avatar] │
├─────────────────────────────────────────────────────────────────┤
│ [HOME] [MY ADS] [CREATIVE STUDIO] [RESULTS]          [🔮 Lumi] │
└─────────────────────────────────────────────────────────────────┘
```

The Lumi button will be:
- A gradient-styled bubble matching the brand
- Positioned at the far right of the tabs row
- Always visible and clickable to open chat
- Shows unread indicator if there are recommendations

---

## Implementation Details

### DashboardLayout.tsx Changes

Add Lumi button to the navigation tabs row:

```typescript
// Import the chat open hook
import { useLumiAssistant } from "@/components/LumiAssistant";

// Inside the desktop layout, in the nav section:
<nav className="flex items-end justify-between mt-4 md:mt-6 -mb-3 md:-mb-4">
  <div className="flex space-x-1 pb-px">
    {/* Existing tab items */}
  </div>
  
  {/* Lumi Chat Button - Desktop Only */}
  <button
    onClick={() => openChat()}
    className="flex items-center gap-2 px-4 py-2 rounded-full 
               bg-gradient-lumi text-white font-medium text-sm
               shadow-lg shadow-lumi-pink-1/20 hover:shadow-xl
               transition-all mb-1"
  >
    <SparkleIcon size="xs" state="idle" />
    <span>Ask Lumi</span>
  </button>
</nav>
```

### LumiAssistant.tsx Changes

1. **Add context value** for opening chat programmatically:

```typescript
interface LumiAssistantContextValue {
  // ...existing
  openChat: () => void;
  isDesktopLayout: boolean;
}
```

2. **Conditionally render floating button** only on mobile/non-dashboard pages

3. **Export the open method** for use in DashboardLayout

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/components/ui/sonner.tsx` | Add `position="top-center"` |
| `src/components/DashboardLayout.tsx` | Add inline Lumi button in desktop nav row |
| `src/components/LumiAssistant.tsx` | Add `openChat` to context, conditionally hide floating button on desktop |
| ~18 component/page files | Replace "AI" text with "smart" variants |
| `index.html` | Update meta descriptions |
| 2 edge function files | Update error messages |

---

## Implementation Order

1. Update `sonner.tsx` to position notifications at top-center
2. Update `LumiAssistant.tsx` to expose `openChat` method and add layout detection
3. Update `DashboardLayout.tsx` to include inline Lumi button in desktop nav
4. Replace all "AI" text occurrences across the codebase
5. Test on both mobile and desktop layouts

