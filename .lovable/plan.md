

# Update Empty State Feature Cards

## What Changes

Replace the "Smart Templates / Proven formats" card in the Ads empty state with messaging that highlights the app's real differentiator: psychology-driven creative.

### File: `src/components/AdsEmptyState.tsx`

**Before:**
| Card | Title | Subtitle |
|------|-------|----------|
| 1 | Smart Copywriting | Headlines & scripts |
| 2 | Smart Templates | Proven formats |
| 3 | One-Click Launch | Publish to Meta |

**After:**
| Card | Title | Subtitle |
|------|-------|----------|
| 1 | Smart Copywriting | Headlines & scripts |
| 2 | Psychology-Backed Creative | Angles that convert |
| 3 | One-Click Launch | Publish to Meta |

Also swap the `Layout` icon for a `Brain` icon (from lucide-react) to reinforce the psychology angle.

The subtitle text and helper text below the CTA will also be updated:
- Subtitle: "Our smart wizard" becomes "Lumi builds your ads using audience psychology, proven creative angles, and Meta best practices"
- Helper text: Updated to mention "psychology-driven ad copy, creative direction with proven angles, and a launch-ready campaign"

