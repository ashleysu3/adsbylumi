
# Enhanced Audience Psychology System with Content Assets Integration

## Overview

This plan enhances the psychology system to create a two-tier psychological profile structure:

1. **Brand-Level Psychology** - General audience profile for the brand overall
2. **Offer-Level Psychology** - Detailed profile relating the ideal client to each specific offer

Additionally, content assets (testimonials, scripts, etc.) will be used to enrich the AI-generated psychology, and users will be prompted to update their psychology when new content is added.

---

## Technical Implementation

### Part 1: Database Schema Enhancement

Add a new column to track when content assets were last used to generate psychology:

```sql
-- Add tracking columns to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS 
  psychology_content_hash TEXT;
-- Stores a hash of content asset IDs used when psychology was last generated

ALTER TABLE brands ADD COLUMN IF NOT EXISTS
  psychology_generated_at TIMESTAMPTZ;
-- When the psychology was last generated/updated

-- Add offer-specific audience psychology column to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS
  offer_audience_psychology JSONB;
-- Stores offer-specific audience insights (how the ideal client relates to THIS offer)

ALTER TABLE offers ADD COLUMN IF NOT EXISTS
  psychology_content_hash TEXT;
-- Tracks which content assets were used when offer psychology was generated
```

---

### Part 2: Content Assets → Psychology Integration

#### Update `generate-audience-psychology` Edge Function

Enhance the function to:
1. Fetch all content assets for the brand
2. Include them in the AI prompt as real language/insights
3. Store a hash of which assets were used
4. Generate a richer, more specific psychology profile

```typescript
// In generate-audience-psychology/index.ts

// Fetch content assets for this brand
const { data: contentAssets } = await supabase
  .from("brand_content_assets")
  .select("id, asset_type, content")
  .eq("brand_id", brandId);

// Build content context for the AI
let contentContext = "";
if (contentAssets?.length) {
  contentContext = "\n\nREAL USER-PROVIDED CONTENT:\n";
  contentAssets.forEach(asset => {
    const typeLabel = {
      testimonials: "CLIENT TESTIMONIALS (real words from clients)",
      survey_answers: "SURVEY RESPONSES (actual pain points in client language)",
      client_objections: "COMMON OBJECTIONS & QUESTIONS",
      webinar_scripts: "WEBINAR/CHALLENGE SCRIPTS"
    }[asset.asset_type] || asset.asset_type.toUpperCase();
    
    contentContext += `\n## ${typeLabel}\n${asset.content}\n`;
  });
  contentContext += "\nIMPORTANT: Use the EXACT language, phrases, and specific pain points from the content above. These are REAL words from REAL clients.\n";
}

// Generate hash of content asset IDs for tracking
const contentHash = contentAssets?.length 
  ? contentAssets.map(a => a.id).sort().join(',')
  : null;

// After saving psychology, also save the hash
await supabase
  .from('brands')
  .update({
    audience_psychology: psychology,
    psychology_status: 'completed',
    psychology_content_hash: contentHash,
    psychology_generated_at: new Date().toISOString()
  })
  .eq('id', brandId);
```

#### Update `generate-product-psychology` Edge Function

Similarly enhance to:
1. Include brand-level psychology as foundation
2. Fetch offer-specific content assets
3. Generate offer-audience psychology (how the ideal client relates to this specific offer)
4. Store in the new `offer_audience_psychology` field

---

### Part 3: Prompt User to Update Psychology

#### New Component: `PsychologyUpdatePrompt.tsx`

A non-intrusive banner/card that appears when:
- New content assets have been added since psychology was last generated
- The content hash doesn't match

```text
+--------------------------------------------------+
| 📝 New content added since your last psychology  |
|    profile. Want Lumi to incorporate it?         |
|                                                   |
|    [Update Psychology]    [Dismiss for now]      |
+--------------------------------------------------+
```

#### Integration in `ContentAssetsEditor.tsx`

After saving a content asset:
1. Check if brand has existing psychology
2. Compare current content hash with stored hash
3. If different, show a prompt asking if they want to regenerate

```typescript
// After saving an asset
const checkPsychologyUpdate = async () => {
  if (!brand?.audience_psychology) return; // No psychology yet
  
  const { data: assets } = await supabase
    .from('brand_content_assets')
    .select('id')
    .eq('brand_id', brandId);
    
  const currentHash = assets?.map(a => a.id).sort().join(',') || '';
  
  if (brand.psychology_content_hash !== currentHash) {
    // Show prompt to update psychology
    setShowPsychologyUpdatePrompt(true);
  }
};
```

#### Integration in Dashboard Psychology Tab

Show an alert when content assets exist but weren't used in the current psychology:

```typescript
// In AudiencePsychology component
const hasNewContent = useMemo(() => {
  if (!contentAssets?.length) return false;
  const currentHash = contentAssets.map(a => a.id).sort().join(',');
  return currentHash !== brand?.psychology_content_hash;
}, [contentAssets, brand?.psychology_content_hash]);
```

---

### Part 4: Offer-Level Audience Psychology

#### Update `OfferManager.tsx`

Display the offer-specific audience psychology (how the ideal client relates to this offer):

```typescript
// Inside the offer card expansion
{offer.offer_audience_psychology && (
  <div className="space-y-3">
    <h5 className="font-semibold text-sm">How Your Audience Relates to This Offer</h5>
    
    {offer.offer_audience_psychology.why_they_need_this && (
      <div>
        <p className="text-xs font-medium">Why They Need This</p>
        <p className="text-sm text-muted-foreground">
          {offer.offer_audience_psychology.why_they_need_this}
        </p>
      </div>
    )}
    
    {offer.offer_audience_psychology.specific_hesitations?.length > 0 && (
      <div>
        <p className="text-xs font-medium">Specific Hesitations About This Offer</p>
        <ul className="text-sm text-muted-foreground">
          {offer.offer_audience_psychology.specific_hesitations.map((h, i) => (
            <li key={i}>• {h}</li>
          ))}
        </ul>
      </div>
    )}
    
    {/* Additional offer-audience insights */}
  </div>
)}
```

#### Update `generate-product-psychology` to Include Offer-Audience Psychology

The AI prompt will generate:
1. **Product Psychology** (current) - positioning, product-specific pain points, buying triggers
2. **Offer-Audience Psychology** (new) - how the ideal client relates to THIS specific offer

```typescript
const systemPrompt = `...
Generate TWO related profiles:

1. PRODUCT PSYCHOLOGY (how this product is positioned)
   - positioning
   - product_pain_points
   - product_desires
   - product_objections
   - buying_triggers

2. OFFER-AUDIENCE PSYCHOLOGY (how YOUR audience relates to THIS offer)
   - why_they_need_this: Why someone with their psychology needs THIS specific offer
   - moment_they_realize: The moment they realize they need this (specific scenario)
   - specific_hesitations: Array of objections specific to THIS offer/price point
   - what_finally_convinces: What makes them say yes to THIS (not just any solution)
   - alternative_they_tried: What they've tried before that didn't work
   - emotional_before_after: Before state → After state specific to this offer

Return JSON with both "product_psychology" and "offer_audience_psychology" objects.
...`;
```

---

### Part 5: Creative Generation Integration

#### Update Edge Functions to Use Both Psychology Levels

**`generate-creative-angles/index.ts`**:
```typescript
// Include both brand-level and offer-level psychology
const systemPrompt = `...
=== BRAND-LEVEL AUDIENCE PSYCHOLOGY ===
${JSON.stringify(audiencePsychology, null, 2)}

=== OFFER-SPECIFIC AUDIENCE INSIGHTS ===
Why They Need This: ${offerAudiencePsychology?.why_they_need_this || 'Not specified'}
Moment of Realization: ${offerAudiencePsychology?.moment_they_realize || 'Not specified'}
Specific Hesitations: ${offerAudiencePsychology?.specific_hesitations?.join('\n') || 'Not specified'}
What Convinces Them: ${offerAudiencePsychology?.what_finally_convinces || 'Not specified'}

Use the brand-level psychology for broad appeal, and the offer-specific insights for targeted messaging.
...`;
```

**`generate-creative-grid/index.ts`** and **`generate-angle-copy/index.ts`**:
- Pass offer_audience_psychology alongside product_psychology
- AI uses both to create highly targeted hooks, scripts, and copy

---

### Part 6: Files to Create/Modify

**Database Migration** (new):
```sql
-- Add psychology tracking and offer-audience psychology columns
ALTER TABLE brands 
  ADD COLUMN IF NOT EXISTS psychology_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS psychology_generated_at TIMESTAMPTZ;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offer_audience_psychology JSONB,
  ADD COLUMN IF NOT EXISTS psychology_content_hash TEXT;
```

**New Component**:
- `src/components/PsychologyUpdatePrompt.tsx` - Banner prompting users to update psychology

**Modified Files**:
- `src/components/ContentAssetsEditor.tsx` - Add psychology update check after save
- `src/components/AudiencePsychology.tsx` - Show "new content available" alert
- `src/components/OfferManager.tsx` - Display offer-audience psychology
- `supabase/functions/generate-audience-psychology/index.ts` - Use content assets
- `supabase/functions/generate-product-psychology/index.ts` - Generate offer-audience psychology
- `supabase/functions/generate-creative-angles/index.ts` - Use both psychology levels
- `supabase/functions/generate-creative-grid/index.ts` - Use both psychology levels
- `supabase/functions/generate-angle-copy/index.ts` - Use both psychology levels

---

### Part 7: UX Flow

#### When User Adds Content Assets:
1. User pastes testimonials/scripts/etc. in Content Library
2. Clicks Save
3. If brand psychology exists and wasn't generated with these assets:
   - Show banner: "Want to update your audience psychology with this new content?"
   - User clicks "Update" → triggers regeneration with content context
   - Or clicks "Later" → banner dismisses (reappears on next save)

#### When User Views Audience Psychology:
1. If content assets exist but weren't used in generation:
   - Show info badge: "3 content assets available - regenerate to include"
2. Regenerate button always visible
3. On regenerate, includes all content assets

#### When User Adds/Views Offers:
1. Each offer shows its own "How Your Audience Relates to This Offer" section
2. This is distinct from the general product psychology
3. Both are used when generating creative for that offer

---

### Implementation Order

1. Create database migration for new columns
2. Update `generate-audience-psychology` to use content assets
3. Update `generate-product-psychology` to generate offer-audience psychology
4. Create `PsychologyUpdatePrompt` component
5. Update `ContentAssetsEditor` to check for psychology updates
6. Update `AudiencePsychology` to show content availability indicator
7. Update `OfferManager` to display offer-audience psychology
8. Update all creative generation edge functions to use both psychology levels
9. Test full flow: add content → update psychology → generate creative
