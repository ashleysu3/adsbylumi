

## Trend Translator for LUMI

Build a "Trend Translator" feature that lets users paste an Instagram/TikTok link, have LUMI analyze the trend using the brand's existing context (offers, audience psychology, brand voice), and output a translated ad concept they can push into a campaign.

### Architecture

**New page**: `/trend-translator` — accessible from the Creative Toolkit sidebar nav item area (add as a dedicated link in the Create section of the sidebar, under Creative Toolkit).

**New edge function**: `supabase/functions/translate-trend/index.ts` — adapted from the Trend Transformer project's `analyze-trend` function, but enhanced to pull brand/offer context from the database instead of requiring manual input.

**New component**: `src/pages/TrendTranslator.tsx` — the page UI.

### How It Works

1. User pastes an Instagram or TikTok URL (or describes a trend in text)
2. LUMI auto-fills context from the active brand (offer, audience, brand voice, audience psychology) — no manual entry needed
3. Edge function scrapes the post content (oEmbed, meta tags, Firecrawl if available, direct fetch), then sends it to Lovable AI with brand context for analysis
4. Output displays: Why it works, Format Blueprint, Hook Variations (written for their niche), Filming Tips, Ready-to-Post Caption, and a full Ad Concept
5. User can "Use This in a Campaign" which navigates to `/create` with the translated angle pre-loaded, or save the concept to their Concept Library

### Changes

#### 1. New page: `src/pages/TrendTranslator.tsx`
- Wrapped in `DashboardLayout`
- Simple form: URL/text input field + optional offer selector (defaults to first active offer)
- Uses `useBrand()` context to auto-populate brand voice, audience, industry
- Fetches active offers from DB to let user pick which offer to translate against
- Calls `translate-trend` edge function
- Displays results using sections similar to Trend Transformer's `AnalysisOutput`: Why It Works, Format Blueprint, Hook Variations, Filming Tips, Caption, Ad Concept
- Action buttons: "Save to Concept Library" (inserts into `content_ideas` table), "Use in Campaign" (navigates to `/create` with pre-seeded data)

#### 2. New edge function: `supabase/functions/translate-trend/index.ts`
- Ported from Trend Transformer's `analyze-trend/index.ts` with these adaptations:
  - Accepts `brandId` and `offerId` instead of manual offer/audience/brandVoice fields
  - Fetches brand data (name, industry, brand_voice, target_audience, audience_psychology) and offer data (name, description, price_point, target_outcome, product_psychology) from DB using service role key
  - Builds a richer prompt using LUMI's existing knowledge about the brand
  - Keeps all scraping strategies (oEmbed, meta tags, embed page, direct fetch) — skips Firecrawl/RapidAPI since those keys aren't configured in this project
  - Uses `google/gemini-2.5-flash` model via Lovable AI gateway
  - Uses tool calling for structured JSON output (per project standards) instead of raw JSON parsing
  - Handles 429/402 errors properly

#### 3. Route: `src/App.tsx`
- Add route: `<Route path="/trend-translator" element={<TrendTranslator />} />`

#### 4. Sidebar: `src/components/AppSidebar.tsx`
- Add `{ path: "/trend-translator", icon: Sparkles, label: "Trend Translator", tooltip: "Turn trending content into ads for your brand" }` to the `createNav` array, after Creative Toolkit

#### 5. Config: `supabase/config.toml`
- Add `[functions.translate-trend]` with `verify_jwt = false`

### No database changes needed
- Saving to Concept Library uses existing `content_ideas` table
- All brand/offer data already exists in `brands` and `offers` tables

