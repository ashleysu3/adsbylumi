

# Adjust Description Character Limit to 27 Characters

## Overview

Meta only displays approximately 26-30 characters for the description field in most ad placements. The current system generates 125-character descriptions that get truncated. This plan aligns all description fields to a 27-character limit and reframes descriptions as short, complimentary phrases rather than standalone content.

---

## Current State

| Component | Current Limit | Issue |
|-----------|---------------|-------|
| `generate-angle-copy` | 125 chars | Way too long, gets truncated |
| `AngleCopyEditor.tsx` | 125 chars | Inconsistent with actual display |
| `CopyEditor.tsx` | 30 chars | Close but could be tighter |
| `finalize-ad-copy` | 30 chars | Already correct |
| `generate-copy-variations` | 30 chars | Already correct |

---

## Changes

### 1. Edge Function: `generate-angle-copy/index.ts`

**Before (line 204):**
```
- Descriptions: Max 125 characters, expand on the headline
```

**After:**
```
- Descriptions: Max 27 characters, short complement to the headline (e.g., "Start your free trial", "See how it works")
```

Also update the output format example to show shorter descriptions with correct character counts.

---

### 2. Frontend: `AngleCopyEditor.tsx`

**Before (lines 317-321):**
```typescript
maxLength={125}
className="pr-14"
...
{d.text?.length || 0}/125
```

**After:**
```typescript
maxLength={27}
className="pr-12"
...
{d.text?.length || 0}/27
```

---

### 3. Update Purpose Explanation

In the AI prompt, change the framing from "expand on the headline" to emphasize that descriptions are supplementary micro-text:

```
- Descriptions: Max 27 characters. These appear below headlines in some placements. 
  Keep them punchy and action-oriented (e.g., "Try it free", "Learn how", "Get started now").
  They complement the headline — don't repeat it.
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-angle-copy/index.ts` | Update character limit from 125 to 27, change purpose description |
| `src/components/creative/AngleCopyEditor.tsx` | Update `maxLength` from 125 to 27, update counter display |

---

## Technical Details

### Edge Function Update

**File:** `supabase/functions/generate-angle-copy/index.ts`

**Line 204 - Change copy requirements:**
```typescript
// BEFORE
- Descriptions: Max 125 characters, expand on the headline

// AFTER  
- Descriptions: Max 27 characters, short action phrase that complements the headline (e.g., "Start free today", "See the results")
```

**Lines 189-191 - Update output format example:**
```typescript
// BEFORE
"descriptions": [
  { "text": "...", "framework": "PAS", "character_count": 85 },
  { "text": "...", "framework": "Before/After", "character_count": 90 }
],

// AFTER
"descriptions": [
  { "text": "Start your free trial", "framework": "Direct", "character_count": 21 },
  { "text": "See real results now", "framework": "Action", "character_count": 20 }
],
```

---

### Frontend Update

**File:** `src/components/creative/AngleCopyEditor.tsx`

**Lines 313-321:**
```typescript
// Change from:
<Input
  value={d.text}
  onChange={(e) => updateVariation("descriptions", i, e.target.value)}
  placeholder="Enter description..."
  maxLength={125}
  className="pr-14"
/>
<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
  {d.text?.length || 0}/125
</span>

// Change to:
<Input
  value={d.text}
  onChange={(e) => updateVariation("descriptions", i, e.target.value)}
  placeholder="Try it free today"
  maxLength={27}
  className="pr-12"
/>
<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
  {d.text?.length || 0}/27
</span>
```

---

## Example Descriptions (27 chars or less)

Good descriptions that fit:
- "Start your free trial" (21 chars)
- "See how it works" (16 chars)  
- "Get started today" (17 chars)
- "Try it risk-free" (16 chars)
- "Learn the method" (15 chars)
- "Join 10k+ coaches" (17 chars)
- "Limited time offer" (18 chars)
- "Watch the free class" (20 chars)

---

## Summary

This change ensures generated descriptions actually fit in Meta's display area instead of being truncated. The AI will now generate short, punchy phrases that complement the headline rather than trying to expand on it.

