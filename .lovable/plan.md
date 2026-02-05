

# Combine Brand Copy + Audience Psychology into "Brand Brain" Tab

## Overview

This plan merges the separate "Brand Copy" and "Audience Psychology" tabs into a unified "Brand Brain" tab that represents all the strategic intelligence about your brand and audience. Additionally, we'll enhance loading states to provide clear, reassuring feedback during longer AI operations.

---

## Part 1: Merge Tabs into "Brand Brain"

### Current State
- **Brand Copy Tab**: Contains ContentAssetsEditor (content library) + Emoji Settings + Meta Best Practices card
- **Audience Psychology Tab**: Contains AudiencePsychology component (generate/edit/approve psychology profile)
- Both tabs are accessed separately via the TabsList

### New Structure: Single "Brand Brain" Tab

The combined tab will have a logical flow with clear sections:

```text
+--------------------------------------------------+
| 🧠 Brand Brain                                   |
| Your brand's strategic intelligence center       |
+--------------------------------------------------+

┌──────────────────────────────────────────────────┐
│ 📚 Content Library                     [Expand]  │
│ Paste testimonials, scripts, objections...       │
│ ┌────────────────────────────────────────────┐  │
│ │ [Content assets editor - numbered cards]   │  │
│ └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 🧠 Audience Psychology            [Approved ✓]   │
│ Deep psychological profile based on your content │
│ ┌────────────────────────────────────────────┐  │
│ │ Demographics, Pain Points, Desires, etc.   │  │
│ └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 😊 Copy Preferences                              │
│ Emoji and formatting settings for AI copy        │
│ ┌────────────────────────────────────────────┐  │
│ │ Emoji toggle, brand emojis, bullet style   │  │
│ └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Why This Order?
1. **Content Library first** - Users add their raw material (testimonials, scripts)
2. **Audience Psychology second** - AI uses that content to generate insights
3. **Copy Preferences last** - Fine-tune how AI outputs copy (emojis, formatting)

---

## Part 2: Enhanced Loading States

### Problem
When generating audience psychology, the `generating` state only shows a spinner button. Users may think it's stuck or cancel prematurely during longer AI operations (10-30+ seconds).

### Solution: Use LumiThinking Modal

Replace the simple toast + spinner with the `LumiThinking` modal that provides:
- Progress bar animation
- Rotating reassuring microcopy
- Clear indication that work is happening

### Implementation

**In `AudiencePsychology.tsx`:**

```typescript
import { LumiThinking } from "@/components/LumiThinking";

// Custom copy for psychology generation context
const PSYCHOLOGY_LOADING_COPY = [
  "Analyzing your brand's positioning...",
  "Understanding your ideal client...",
  "Mapping psychological pain points...",
  "Identifying what motivates your audience...",
  "Building your psychology profile...",
  "This takes a moment — worth it.",
];

// In the component
<LumiThinking 
  isOpen={generating} 
  customCopy={PSYCHOLOGY_LOADING_COPY}
/>
```

### Other Components to Enhance

Apply the same pattern to other long-running operations:

| Component | Current State | Enhancement |
|-----------|---------------|-------------|
| `AudiencePsychology` | Toast + spinner | LumiThinking modal with custom copy |
| `OfferManager` (product psychology) | Inline loader | LumiThinking modal |
| `ContentAssetsEditor` (save) | Toast | Keep toast (fast operation) |

---

## Part 3: Files to Modify

### `src/pages/Dashboard.tsx`

1. **Remove** the separate "Brand Copy" and "Audience Psychology" tabs
2. **Add** a single "Brand Brain" tab with Brain icon
3. **Combine** all content into the new tab in logical order:
   - ContentAssetsEditor (Content Library)
   - AudiencePsychology component
   - Emoji Settings card
   - Meta Best Practices card (optional - could remove as less critical)

4. **Update** TabsList to show 3 tabs:
   ```typescript
   <TabsTrigger value="overview">Overview</TabsTrigger>
   <TabsTrigger value="brand-brain">Brand Brain</TabsTrigger>  // NEW
   <TabsTrigger value="offers">Offers</TabsTrigger>
   ```

### `src/components/BrandOnboardingWizard.tsx`

1. **Update** step 2 from "Brand Copy" to "Brand Brain"
2. **Merge** steps 2 and 3 into a single "Brand Brain" step, or keep as separate wizard steps that both navigate to the same tab

### `src/components/InlineProgressChecklist.tsx`

1. **Update** the "Audience" step to point to the new "brand-brain" section
2. Ensure scroll-to-section works correctly

### `src/components/AudiencePsychology.tsx`

1. **Import** LumiThinking component
2. **Add** custom loading copy for psychology generation
3. **Show** LumiThinking modal when `generating` is true
4. **Remove** or keep the toast as a fallback notification

---

## Part 4: Tab Content Structure

```typescript
{/* Brand Brain Tab */}
<TabsContent value="brand-brain" className="space-y-6">
  {/* Section 1: Content Library */}
  <ContentAssetsEditor 
    brandId={brand.id} 
    offers={offers.map(o => ({ id: o.id, name: o.name }))} 
  />

  {/* Section 2: Audience Psychology */}
  <div data-section="audience-psychology">
    <AudiencePsychology
      brandId={brand.id}
      psychology={brand.audience_psychology}
      status={brand.psychology_status}
      psychologyContentHash={brand.psychology_content_hash}
      psychologyGeneratedAt={brand.psychology_generated_at}
      onUpdate={fetchBrandData}
    />
  </div>

  {/* Section 3: Copy Preferences (Emoji Settings) */}
  <Card variant="glow">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Smile className="h-5 w-5" />
        Copy Preferences
      </CardTitle>
      <CardDescription>
        Control how Lumi formats your AI-generated ad copy
      </CardDescription>
    </CardHeader>
    <CardContent>
      {/* Emoji toggle, brand emojis, bullet style */}
    </CardContent>
  </Card>

  {/* Section 4: Meta Best Practices (info card) */}
  <Card>
    <CardHeader>
      <CardTitle>Meta Best Practices for Copy</CardTitle>
    </CardHeader>
    {/* ... */}
  </Card>
</TabsContent>
```

---

## Part 5: Loading State Enhancement Details

### Custom Loading Copy Pools

```typescript
// For Audience Psychology generation
const PSYCHOLOGY_COPY = [
  "Analyzing your brand positioning...",
  "Understanding your ideal client...", 
  "Mapping psychological triggers...",
  "Identifying what motivates action...",
  "Building a psychology profile...",
  "This takes a moment — worth it.",
];

// For Offer/Product Psychology  
const PRODUCT_PSYCHOLOGY_COPY = [
  "Connecting offer to audience needs...",
  "Identifying why they need this...",
  "Finding the moment of realization...",
  "Mapping purchase hesitations...",
  "Building offer-specific insights...",
];
```

### Modal Behavior
- Modal prevents dismissal (no click-outside or escape)
- Progress bar animates slowly to indicate ongoing work
- Copy rotates every 4.5 seconds for a calm pace
- After 30 seconds, switches to "long load" reassurance copy

---

## Summary of Changes

| File | Change |
|------|--------|
| `Dashboard.tsx` | Merge Brand Copy + Psychology tabs → Brand Brain |
| `BrandOnboardingWizard.tsx` | Update step references to new tab structure |
| `InlineProgressChecklist.tsx` | Update section references |
| `AudiencePsychology.tsx` | Add LumiThinking modal for generation |
| `OfferManager.tsx` | Add LumiThinking for product psychology generation |

---

## Implementation Order

1. Update `Dashboard.tsx` to combine tabs into "Brand Brain"
2. Update `AudiencePsychology.tsx` with LumiThinking modal
3. Update `BrandOnboardingWizard.tsx` with new tab references
4. Update `InlineProgressChecklist.tsx` section references
5. Update `OfferManager.tsx` with LumiThinking (if needed)
6. Test the full flow

