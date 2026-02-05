
# My Brand Onboarding Wizard + Content Assets System

## Overview

This plan implements two interconnected features:

1. **Guided Onboarding Wizard** - A step-by-step wizard on the My Brand page that guides new users through all four sections (Overview, Brand Copy, Audience Psychology, Offers) with clear navigation and progress tracking

2. **Content Assets Library** - A new feature in the Brand Copy tab where users can paste valuable content (testimonials, webinar scripts, survey responses, client objections/questions) that feeds into AI creative generation

---

## Technical Implementation

### Part 1: Database Schema

Create a new `brand_content_assets` table to store the pasted content:

```sql
CREATE TABLE brand_content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'testimonials',
    'webinar_scripts', 
    'survey_answers',
    'client_objections',
    'client_questions',
    'other'
  )),
  content TEXT NOT NULL,
  label TEXT, -- optional user-provided label
  offer_ids UUID[] DEFAULT '{}', -- link to specific offers (empty = brand-wide)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE brand_content_assets ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own brand's assets
CREATE POLICY "Users can manage their brand's content assets"
  ON brand_content_assets FOR ALL
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );
```

---

### Part 2: New Components

#### 1. `BrandOnboardingWizard.tsx`

A wizard overlay that appears for users who haven't completed their brand profile. Uses the existing `MobileStepWizard` component pattern but adapted for desktop+mobile.

```text
+------------------------------------------+
|  Step 1 of 4: Brand Basics               |
|  [●] [○] [○] [○]                         |
|                                          |
|  Complete your brand profile to unlock   |
|  powerful AI-driven campaigns.           |
|                                          |
|  +------------------------------------+  |
|  | Brand Name: [input]                |  |
|  | Website: [input]                   |  |
|  | Industry: [input]                  |  |
|  +------------------------------------+  |
|                                          |
|       [Skip for now]    [Continue →]     |
+------------------------------------------+
```

**Steps:**
- Step 1: Overview (Brand basics + positioning)
- Step 2: Brand Copy (Emoji settings + Content Assets)
- Step 3: Audience Psychology (Generate/review/approve)
- Step 4: Offers (Add first offer)

**Logic:**
- Shows automatically if brand profile is incomplete (< 100%)
- Can be dismissed with "Skip for now" 
- Each step auto-advances when requirements are met
- Confetti celebration on completion

#### 2. `ContentAssetsEditor.tsx`

A collapsible card in the Brand Copy tab for managing content assets.

```text
+------------------------------------------+
| 📚 Your Content Library (optional)       |
| Paste existing content to supercharge    |
| your AI-generated ads.                   |
+------------------------------------------+
| ▼ Testimonials                           |
|   +------------------------------------+ |
|   | [Paste testimonials here...]       | |
|   +------------------------------------+ |
|   Link to: ○ All Offers  ○ Specific... | |
+------------------------------------------+
| ▼ Webinar/Challenge Scripts              |
| ▼ Survey Responses                       |
| ▼ Client Objections & Questions          |
| ▼ Other Useful Content                   |
+------------------------------------------+
|                     [Save Content]       |
+------------------------------------------+
```

**Features:**
- Collapsible sections for each content type
- Multi-line textarea for each category
- Toggle: "Apply to all offers" or select specific offer(s)
- Auto-save on blur
- Visual indicator showing content is available

---

### Part 3: AI Integration

Modify these edge functions to include content assets:

#### `generate-creative-angles/index.ts`
Add fetching of `brand_content_assets` and include in the prompt:

```typescript
// Fetch content assets for this brand
const { data: contentAssets } = await supabase
  .from("brand_content_assets")
  .select("*")
  .eq("brand_id", brandId);

// Build content context
let contentContext = "";
if (contentAssets?.length) {
  contentContext = "\n\nUSER-PROVIDED CONTENT ASSETS:\n";
  contentAssets.forEach(asset => {
    contentContext += `\n## ${asset.asset_type.toUpperCase()}:\n${asset.content}\n`;
  });
  contentContext += "\nUse these real testimonials, objections, and language patterns to create more authentic, specific angles.\n";
}
```

#### `generate-angle-copy/index.ts`
Same pattern - fetch and inject content assets.

#### `generate-creative-grid/index.ts` 
Same pattern - content assets provide real language for hooks and scripts.

---

### Part 4: Component Updates

#### `Dashboard.tsx` (My Brand page)

**Changes:**
1. Add state to track wizard visibility: `showOnboardingWizard`
2. Show wizard overlay when profile is incomplete and user hasn't dismissed it
3. Add `ContentAssetsEditor` component to Brand Copy tab
4. Update tab switching to work with wizard navigation

#### New wizard flow logic:

```typescript
// Show wizard if:
// 1. Brand profile < 100% complete
// 2. User hasn't dismissed the wizard for this brand
// 3. It's within the first 7 days of brand creation
const shouldShowWizard = useMemo(() => {
  if (!brand) return false;
  const dismissedKey = `brand-wizard-dismissed-${brand.id}`;
  if (localStorage.getItem(dismissedKey)) return false;
  
  const progress = calculateBrandProgress();
  return progress.percentage < 100;
}, [brand]);
```

---

### Part 5: Files to Create/Modify

**New Files:**
- `src/components/BrandOnboardingWizard.tsx` - Main wizard component
- `src/components/ContentAssetsEditor.tsx` - Content library UI
- `supabase/migrations/xxx_add_content_assets.sql` - Database migration

**Modified Files:**
- `src/pages/Dashboard.tsx` - Add wizard trigger + ContentAssetsEditor
- `supabase/functions/generate-creative-angles/index.ts` - Fetch + use assets
- `supabase/functions/generate-angle-copy/index.ts` - Fetch + use assets  
- `supabase/functions/generate-creative-grid/index.ts` - Fetch + use assets

---

### Part 6: UX Details

#### Wizard Step Navigation

Each step has:
- Clear title and description
- Progress dots (clickable if previous steps complete)
- "Back" button (except step 1)
- "Continue" / "Skip for now" buttons
- Auto-advance when step requirements are met

#### Content Assets UX

- Optional - never blocks the wizard
- Clear labels explaining what each field is for
- Examples placeholder text:
  - Testimonials: "Paste client testimonials, reviews, or success stories..."
  - Webinar Scripts: "Paste your webinar intro, key points, or challenge day scripts..."
  - Survey Answers: "Paste responses from surveys about pain points, goals, etc..."
  - Objections: "What questions or objections do clients commonly raise?"
- Badge showing "3 assets saved" when content exists
- Linked offers show as chips

#### Mobile Considerations

- Wizard uses same swipe navigation as MobilePlanningWizard
- Textarea height adapts to content
- Offer selector uses a bottom sheet on mobile

---

### Implementation Order

1. Create database migration for `brand_content_assets` table
2. Create `ContentAssetsEditor.tsx` component
3. Add ContentAssetsEditor to Dashboard Brand Copy tab
4. Create `BrandOnboardingWizard.tsx` component
5. Integrate wizard into Dashboard.tsx
6. Update edge functions to fetch and use content assets
7. Test full flow: onboarding → content input → creative generation
