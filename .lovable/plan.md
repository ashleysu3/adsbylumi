

# Enhance Talking Head Scripts for Non-Actors

## Overview
Make talking head scripts more practical for coaches and creators who are not actors and want simple, teleprompter-ready scripts with easy-to-execute visual hooks that feel natural to their everyday life.

## Current State
The system already generates:
- Verbal, written, and visual hooks (three-hook system)
- Line-by-line scripts (4-8 lines)
- Text overlays with timing
- Caption reminder

However, the current prompts can result in:
- Visual hooks that feel too "produced" (burning paper, empty wallet)
- Scripts that feel like they require acting ability
- Missing the "mid-sentence start" technique that creates urgency
- Generic visual suggestions not tied to the user's actual life/brand

## Proposed Enhancements

### 1. Update AI Prompt for Simpler, More Natural Scripts

**File:** `supabase/functions/generate-creative-grid/index.ts`

Update the talking head section to emphasize:
- **Mid-sentence/mid-thought starts** (e.g., "—and that's when I realized...")
- **Everyday visual hooks** specific to their brand/niche (walking, coffee in hand, in car, petting dog, at desk)
- **Conversational script structure** that reads naturally off a teleprompter
- **No acting required** language that guides the AI to produce simple, authentic delivery notes
- **Hook type variety** including the powerful "starting mid-sentence" technique

Add new guidance sections:

```text
=== LOW-PRODUCTION VISUAL HOOK LIBRARY ===
Always suggest SIMPLE, everyday visual hooks based on the user's niche:
- Walking down stairs/hallway
- Sitting in car (parked)
- Petting their dog/cat
- At their desk (real, not staged)
- Making/holding coffee or tea
- Walking outside
- Looking at phone, then looking up

=== MID-SENTENCE START TECHNIQUE ===
One of the most powerful hooks is starting MID-THOUGHT:
- "—and that's exactly why I stopped doing it."
- "—so when she asked me that, I had no answer."
- "—but here's what nobody tells you about that."
This creates the feeling that viewers walked into a private conversation.

=== SCRIPT READABILITY RULES ===
- Each line should be ONE thought (easy to read on teleprompter)
- Use natural pauses (...) where they'd naturally breathe
- Include delivery notes in parentheses when helpful: "(pause)" "(lean in)"
- Structure: Hook (mid-sentence OR confession) → "Here's the thing" transition → Problem → Pivot → Soft CTA
```

### 2. Add New Script Fields for Enhanced Guidance

**Files to update:**
- `supabase/functions/generate-creative-grid/index.ts`
- `supabase/functions/regenerate-creative-cell/index.ts`
- `src/components/creative/CreativeCell.tsx`
- `src/components/creative/ProductionChecklistPanel.tsx`
- `src/components/ProductionWorkflow.tsx`
- `src/pages/CreativeStudio.tsx`

New optional fields for talking head format:
- `hook_technique`: Type of hook being used ("mid_sentence", "confession", "controversial", "specific_number", "pattern_interrupt")
- `visual_hook_options`: Array of 2-3 simple visual hook alternatives (so user can pick what works for their space)
- `delivery_style`: Brief note on how to deliver ("conversational, like telling a friend" vs "slightly urgent, lean into camera")

### 3. Update Production Workflow UI

**File:** `src/components/ProductionWorkflow.tsx`

Add new sections to the talking head review:
- **Hook Technique Badge** showing which style is being used
- **Visual Hook Options** as selectable alternatives (not just one prescriptive option)
- **Delivery Style** tip card
- **"Copy Full Script" button** for easy teleprompter paste

Visual updates:
- Show visual hook options as a mini card carousel
- Add "Lumi's tip" for the hook technique being used

### 4. Update Regenerate Function with Same Enhancements

**File:** `supabase/functions/regenerate-creative-cell/index.ts`

Mirror the same prompt updates so regenerated cells also follow the low-production, non-actor-friendly approach.

## Technical Implementation Details

### Edge Function Prompt Additions

Add to system prompt in `generate-creative-grid/index.ts`:

```typescript
=== TALKING HEAD - DESIGNED FOR NON-ACTORS ===
Your users are coaches, course creators, and service providers - NOT actors or content creators.
They want to record a simple video on their phone and get back to work.

SCRIPT PHILOSOPHY:
- Write like they're texting a friend, not performing
- Each line = one breath, one thought
- Include natural speech patterns ("Look...", "Here's the thing...", "So...")
- Suggest delivery cues sparingly: "(pause)" or "(lean in)" only when essential

VISUAL HOOK OPTIONS (always provide 2-3 alternatives):
Based on the user's niche, suggest EVERYDAY activities they might actually do:
- Coaches/consultants: "at your desk", "walking to car", "morning coffee"
- Health/fitness: "post-workout", "in kitchen", "getting ready"
- Creatives: "at workspace", "with your tools", "mid-project"
- Service providers: "between client calls", "checking emails", "end of day"

MID-SENTENCE STARTS (use for at least 1 of 3 talking head cells per angle):
This technique is extremely effective because it creates instant curiosity.
Examples:
- "—anyway, that's when I knew I had to change something."
- "—and she looked at me like I was crazy, but..."
- "—so I tried it, and honestly? I didn't expect this."

HOOK TECHNIQUE LABELING:
Include a "hook_technique" field with one of:
- "mid_sentence" - Starting mid-thought
- "confession" - Vulnerable admission
- "controversial" - Bold/contrarian take
- "specific_number" - Using exact numbers for credibility
- "pattern_interrupt" - Unexpected statement
```

### Updated Output Structure

```json
{
  "format": "talking_head",
  "hook": "—anyway, that's when I knew something had to change.",
  "verbal_hook": "—anyway, that's when I knew something had to change.",
  "written_hook": "The moment everything shifted",
  "visual_hook": "Sitting in car after a meeting, slightly tired expression",
  "visual_hook_options": [
    "Sitting in car after a meeting",
    "Walking into your home office",
    "At desk with coffee, natural lighting"
  ],
  "hook_technique": "mid_sentence",
  "delivery_style": "Conversational, like debriefing with a friend after a long day",
  "script_lines": [
    "—anyway, that's when I knew something had to change.",
    "I'd been doing the same thing for months...",
    "Working harder, not smarter. Sound familiar?",
    "(pause) Here's what I realized...",
    "The problem wasn't my effort. It was my approach.",
    "Once I switched to [method], everything clicked."
  ],
  "text_overlays": [
    { "text": "The moment everything shifted", "timing": "0-3s", "type": "hook" },
    { "text": "Sound familiar? 👀", "timing": "6-9s", "type": "transition" },
    { "text": "The ONE thing I changed →", "timing": "15-18s", "type": "cta" }
  ],
  "caption_reminder": true,
  "guidance": "Record in your car or at your desk. Natural lighting. You're just telling a friend about a realization you had."
}
```

### UI Updates for ProductionWorkflow.tsx

Add these new sections:

1. **Hook Technique Badge** with Lumi explanation:
```jsx
{item.hook_technique && (
  <Badge variant="outline" className="gap-1">
    {hookTechniqueLabels[item.hook_technique]}
  </Badge>
)}
```

2. **Visual Hook Options** selector:
```jsx
{item.visual_hook_options?.length > 0 && (
  <div className="space-y-2">
    <p className="text-sm font-medium">Choose Your Visual Hook:</p>
    <div className="flex flex-wrap gap-2">
      {item.visual_hook_options.map((option, i) => (
        <Button key={i} variant="outline" size="sm">
          {option}
        </Button>
      ))}
    </div>
  </div>
)}
```

3. **Copy Full Script** button:
```jsx
<Button 
  variant="outline" 
  size="sm" 
  onClick={() => copyScriptToClipboard(item.script_lines)}
>
  <Copy className="h-4 w-4 mr-1" /> Copy Script
</Button>
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-creative-grid/index.ts` | Add non-actor focused prompts, visual hook library, mid-sentence technique, new fields |
| `supabase/functions/regenerate-creative-cell/index.ts` | Mirror same prompt updates |
| `src/components/creative/CreativeCell.tsx` | Add new fields to interface |
| `src/components/creative/ProductionChecklistPanel.tsx` | Add new fields to ProductionItem interface |
| `src/components/ProductionWorkflow.tsx` | Add hook technique badge, visual options selector, copy script button, delivery style tip |
| `src/pages/CreativeStudio.tsx` | Pass new fields through addToChecklist |

## User Experience Improvements

After implementation, users will see:
- Scripts that feel natural to read aloud
- 2-3 visual hook options they can choose from based on their environment
- A "Copy Script" button for easy teleprompter use
- Clear labeling of which hook technique is being used and why
- Delivery style tips that emphasize authenticity over performance
- At least one "mid-sentence start" option per angle for variety

