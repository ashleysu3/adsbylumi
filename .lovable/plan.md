

# Add "Direct from Sales Page" Default Angle

## What This Does

Every time angles are generated, a special first angle called **"Straight from Your Page"** is automatically added and pre-selected. This angle pulls copy and creative concepts directly from the offer's sales page content (name, description, URL, price) instead of generating psychology-driven angles. It produces basic, straightforward creative like:

- "Free Webinar: [Title]"  
- "[Course Name] — Enroll Now"  
- "[Lead Magnet Name] — Download Free"

This ensures there's always one simple, direct option alongside the more creative AI-generated angles.

## How It Works

### 1. Frontend — Inject the default angle (`src/pages/CreativeStudio.tsx`)

After the `generate-creative-angles` edge function returns its 10-12 AI angles, prepend a hardcoded angle:

```
{
  id: "direct_from_page",
  name: "Straight from Your Page",
  description: "Uses copy directly from your sales page — your offer name, description, and call-to-action as-is.",
  isDefault: true
}
```

- This angle is **always pre-selected** in `selectedAngleIds`
- It appears first in the angle list with a distinct visual treatment (e.g., a pin/star icon and "Always included" label)
- It **cannot be deselected** — the checkbox is disabled/locked
- When loading a workspace, if angles exist but `direct_from_page` is missing, inject it

### 2. Frontend — Visual treatment (`src/components/creative/AngleSelector.tsx`)

- Show the default angle card with a subtle "Always included" badge and a lock/pin icon
- Its checkbox is checked and disabled
- Slightly different card style (e.g., dashed border or muted brand gradient background) to distinguish it from AI-generated angles

### 3. Backend — Handle in grid generation (`supabase/functions/generate-creative-grid/index.ts`)

When the `direct_from_page` angle is included in the angles array sent to the grid generator:

- Add special instructions to the AI prompt telling it to generate **basic, direct creative concepts** for this angle:
  - Use the offer name as the headline verbatim
  - Use the offer description as primary copy
  - Generate simple CTAs: "Sign Up Now," "Download Free," "Register Today," "Learn More"
  - Suggest basic visual concepts: offer name as text overlay, simple branded graphic, screenshot of the sales page
  - No psychology tricks, no hooks — just clear, direct messaging from the existing page
- The offer's name, description, price, and URL are already passed to this function, so no new data fetching is needed

### 4. Backend — Handle in copy generation (`supabase/functions/generate-angle-copy/index.ts`)

When generating ad copy for the `direct_from_page` angle:

- Pull headlines and descriptions directly from the offer name and description
- Generate straightforward primary copy that mirrors sales page language
- CTAs should be simple and direct

## Files Changed

| File | Change |
|------|--------|
| `src/pages/CreativeStudio.tsx` | Inject default angle after generation and on workspace load; pre-select it; prevent deselection |
| `src/components/creative/AngleSelector.tsx` | Visual treatment for default angle (badge, lock icon, distinct card style) |
| `supabase/functions/generate-creative-grid/index.ts` | Special prompt instructions for `direct_from_page` angle |
| `supabase/functions/generate-angle-copy/index.ts` | Direct copy generation for `direct_from_page` angle |

## Technical Details

### Default Angle Object
```typescript
const DEFAULT_ANGLE = {
  id: "direct_from_page",
  name: "Straight from Your Page",
  description: "Uses copy directly from your sales page — your offer name, description, and call-to-action as-is.",
  isDefault: true
};
```

### Injection Points in CreativeStudio.tsx

1. **After `generateAngles`** (line ~495): Prepend default angle to `data.angles`, pre-select its ID
2. **In `loadWorkspace`** (line ~311): If loaded angles don't include `direct_from_page`, prepend it
3. **In angle selection toggle**: Skip deselection if `angle.id === "direct_from_page"`

### Grid Generation Prompt Addition
```
For the angle "Straight from Your Page": Generate 3-4 simple, direct creative concepts 
that use the offer's actual name, description, and CTA verbatim. No psychological hooks 
or creative angles — just clear, straightforward ads. Think: offer name as headline, 
sales page description as body copy, "Sign Up Now" or "Download Free" as CTA, 
simple branded visual with offer name.
```
