

# Pre-Generation Creative Context Input

## Overview

When users return to Creative Studio for an existing campaign (e.g., to create fresh angles for a new creative round), give them the option to share additional context that could help Lumi create more relevant angles. This captures insights like:
- Is the audience coming in at the right stage of awareness?
- What's been working or not working in previous creative?
- Any specific direction they want to explore

This information is passed to the AI when generating angles, producing more tailored creative direction.

---

## User Flow

```text
User opens Creative Studio → Has existing workspace selected
                          → If creating NEW angles (first time OR regenerating):
                              → Show optional "Add Context" input before generation
                              → User can add insights or skip
                              → Insights passed to generate-creative-angles function
```

---

## Part 1: New Component - CreativeContextInput

### File: `src/components/creative/CreativeContextInput.tsx`

A collapsible card that appears on the Angles tab when:
1. A workspace is selected
2. No angles exist yet OR user clicked "Regenerate"

The component includes:
- An expandable "Help Lumi create better angles" section
- Pre-written quick-select options for common feedback scenarios
- A free-text area for additional context
- "Skip" and "Generate" action buttons

### UI Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Generate Creative Angles                                         │
│                                                                     │
│ Lumi will suggest unique creative angles for your campaign.        │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 💡 Help Lumi create better angles (optional)           [▼]     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ When expanded:                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Quick select any that apply:                                   │ │
│ │                                                                 │ │
│ │ [ ] Audience is too early in their journey (need education)    │ │
│ │ [ ] Audience is skeptical/has objections to address            │ │
│ │ [ ] Previous creative felt too generic                         │ │
│ │ [ ] Need more urgency/scarcity messaging                       │ │
│ │ [ ] Want to highlight a specific transformation                │ │
│ │ [ ] Focus on a particular pain point                           │ │
│ │                                                                 │ │
│ │ Anything else Lumi should know?                                │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ [Textarea for free-form input]                              │ │ │
│ │ │                                                             │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                        [Skip] [Generate Angles ✨]                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Quick Select Options

| Option | What it tells the AI |
|--------|---------------------|
| "Audience is too early in their journey" | Create more educational, awareness-stage angles |
| "Audience is skeptical/has objections" | Focus on trust-building, proof, and objection handling |
| "Previous creative felt too generic" | Be more specific, use unique angles and real language |
| "Need more urgency/scarcity messaging" | Include time-sensitive and limited opportunity angles |
| "Want to highlight a specific transformation" | Emphasize before/after and result-focused angles |
| "Focus on a particular pain point" | Deep-dive on problem-aware messaging |

---

## Part 2: Component Structure

### Props Interface

```typescript
interface CreativeContextInputProps {
  onGenerate: (context: CreativeContext) => void;
  onSkip: () => void;
  isGenerating: boolean;
  existingContext?: CreativeContext;
}

interface CreativeContext {
  quickSelections: string[];
  additionalNotes: string;
  timestamp: string;
}
```

### Internal State

```typescript
const [expanded, setExpanded] = useState(false);
const [quickSelections, setQuickSelections] = useState<string[]>([]);
const [additionalNotes, setAdditionalNotes] = useState("");
```

---

## Part 3: Integrate into CreativeStudio.tsx

### File: `src/pages/CreativeStudio.tsx`

1. Add state for pre-generation context:
```typescript
const [preGenerationContext, setPreGenerationContext] = useState<CreativeContext | null>(null);
const [showContextInput, setShowContextInput] = useState(false);
```

2. Modify the "Generate Angles" empty state to use the new component:
```typescript
// Replace the simple Card with CreativeContextInput when no angles exist
{availableAngles.length === 0 ? (
  <CreativeContextInput
    onGenerate={(context) => {
      setPreGenerationContext(context);
      generateAngles(context);
    }}
    onSkip={() => generateAngles()}
    isGenerating={generating}
  />
) : (
  // existing angle selector...
)}
```

3. Modify `handleRegenerateClick` to show context input:
```typescript
const handleRegenerateClick = () => {
  if (gridData.length > 0 || productionItems.length > 0) {
    setShowRegenerateConfirm(true);
    return;
  }
  // Show context input before regenerating
  setShowContextInput(true);
};
```

4. Update `generateAngles` to accept and pass context:
```typescript
const generateAngles = async (context?: CreativeContext) => {
  // ... existing code ...
  
  const { data, error } = await supabase.functions.invoke('generate-creative-angles', {
    body: { 
      brandName: workspace.brands?.name, 
      strategyData: workspace.strategy_json, 
      audiencePsychology: workspace.brands?.audience_psychology, 
      offerData: { ... },
      // NEW: Pass the pre-generation context
      preGenerationContext: context || preGenerationContext,
      conversationInsights: workspace.creative_json?.conversationInsights
    }
  });
  
  // Save context to workspace for future reference
  if (context) {
    saveCreativeState({ preGenerationContext: context });
  }
};
```

---

## Part 4: Update Edge Function

### File: `supabase/functions/generate-creative-angles/index.ts`

1. Accept `preGenerationContext` in the request body:
```typescript
const { ..., preGenerationContext } = await req.json();
```

2. Build context string from quick selections and notes:
```typescript
let preGenContext = "";
if (preGenerationContext) {
  preGenContext = "\n\n=== USER DIRECTION FOR THIS CREATIVE ROUND ===\n";
  
  if (preGenerationContext.quickSelections?.length > 0) {
    preGenContext += "The user indicated the following about their audience/needs:\n";
    
    const selectionMappings: Record<string, string> = {
      "audience_early_journey": "- Audience is early in their awareness journey and needs more education before they'll buy",
      "audience_skeptical": "- Audience is skeptical and has objections that need to be addressed (trust is key)",
      "previous_generic": "- Previous creative felt too generic - need more specific, authentic angles",
      "need_urgency": "- Need more urgency and scarcity messaging to drive action",
      "highlight_transformation": "- Want to emphasize the transformation and end results",
      "focus_pain_point": "- Focus deeply on the core pain point"
    };
    
    preGenerationContext.quickSelections.forEach((sel: string) => {
      if (selectionMappings[sel]) {
        preGenContext += selectionMappings[sel] + "\n";
      }
    });
  }
  
  if (preGenerationContext.additionalNotes?.trim()) {
    preGenContext += `\nAdditional direction from user: "${preGenerationContext.additionalNotes}"\n`;
  }
  
  preGenContext += "\nIMPORTANT: Prioritize angles that address the user's specific direction above. This is fresh input for THIS creative round.\n";
}
```

3. Add to the system prompt context (after conversationInsights):
```typescript
const systemPrompt = `You are Lumi's Creative Engine...

KNOWLEDGE BASE:
${kbContext}
${contentAssetsContext}
${insightsContext}
${offerAudienceContext}
${preGenContext}  // <-- NEW

RULES:
...
${preGenerationContext ? "- PRIORITIZE the user's specific direction for this creative round" : ""}
`;
```

---

## Part 5: Store Context in Workspace

Save the pre-generation context to `creative_json` so it can be:
1. Displayed when user returns to the workspace
2. Referenced in future generations
3. Used to understand the creative direction history

```typescript
// In saveCreativeState or after generating
await supabase
  .from("campaign_workspaces")
  .update({
    creative_json: {
      ...currentCreativeJson,
      preGenerationContext: context,
      preGenerationHistory: [
        ...(currentCreativeJson.preGenerationHistory || []),
        { ...context, anglesGeneratedAt: new Date().toISOString() }
      ]
    }
  })
  .eq("id", workspace.id);
```

---

## Part 6: Regeneration Flow with Context

When user clicks "Regenerate" and confirms (if needed), show the context input modal:

```typescript
// After confirmation dialog is confirmed
<Dialog open={showContextInput} onOpenChange={setShowContextInput}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Any direction for this round?</DialogTitle>
      <DialogDescription>
        Help Lumi create angles that better fit your needs.
      </DialogDescription>
    </DialogHeader>
    <CreativeContextInput
      compact // renders in modal style
      onGenerate={(context) => {
        setShowContextInput(false);
        generateAngles(context);
      }}
      onSkip={() => {
        setShowContextInput(false);
        generateAngles();
      }}
      existingContext={workspace?.creative_json?.preGenerationContext}
    />
  </DialogContent>
</Dialog>
```

---

## Part 7: Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/creative/CreativeContextInput.tsx` | **Create** | New component for capturing pre-generation context |
| `src/pages/CreativeStudio.tsx` | **Modify** | Integrate context input, update generateAngles to pass context |
| `supabase/functions/generate-creative-angles/index.ts` | **Modify** | Accept and process preGenerationContext in AI prompt |

---

## Part 8: Quick Select Options Details

```typescript
const QUICK_SELECT_OPTIONS = [
  {
    id: "audience_early_journey",
    label: "Audience needs more education first",
    description: "They're not ready to buy yet"
  },
  {
    id: "audience_skeptical",
    label: "Audience is skeptical",
    description: "Need to build trust and handle objections"
  },
  {
    id: "previous_generic",
    label: "Previous creative felt generic",
    description: "Need more specific, authentic messaging"
  },
  {
    id: "need_urgency",
    label: "Need more urgency",
    description: "Drive action with scarcity/time pressure"
  },
  {
    id: "highlight_transformation",
    label: "Emphasize the transformation",
    description: "Focus on before/after results"
  },
  {
    id: "focus_pain_point",
    label: "Focus on a specific pain point",
    description: "Deep-dive on the core problem"
  }
];
```

---

## Summary

This feature adds an optional but valuable pre-generation input step that:

1. **Captures user direction** - Quick-select options and free-text for context
2. **Informs AI generation** - Passes context to the angle generation prompt
3. **Persists for reference** - Saves context history to the workspace
4. **Stays non-blocking** - Users can skip if they don't have specific direction
5. **Works for both first-time and regeneration** - Context input appears in both flows

Users get more relevant creative angles because Lumi understands their specific situation and needs for this creative round.

