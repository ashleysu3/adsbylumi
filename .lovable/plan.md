

# Improve Visual Directions for Video Creatives

## Problem

The current visual directions in the creative grid generator include subtle "acting" requirements that feel kitschy and unnatural for non-actor users:

| Current Examples | Why It's Problematic |
|------------------|---------------------|
| "slightly tired expression" | Requires conscious facial control |
| "knowing smile" | Feels performative |
| "contemplative look" | Vague and actorly |
| "express genuine frustration" | Oxymoron - you can't "express" genuine emotion |

These put users in their heads about how they look rather than focusing on just speaking naturally.

---

## Solution Philosophy

Replace expression-based directions with **action-based** or **situation-based** directions that naturally result in authentic visuals without requiring the user to "perform":

| Instead of... | Use... |
|---------------|--------|
| "Tired expression" | "Just finished a meeting" (situation) |
| "Knowing smile" | "After sipping coffee" (action creates expression) |
| "Express frustration" | "Talking about something that bugs you" (natural reaction) |
| "Contemplative look" | "Looking at your phone then up at camera" (action-driven) |

---

## Changes to Edge Function

### File: `supabase/functions/generate-creative-grid/index.ts`

### 1. Update Visual Hook Examples (Lines 242-246)

**Current:**
```
VISUAL HOOKS (what they see) - KEEP THESE SIMPLE:
- Everyday moments: "sitting at desk with messy coffee cup", "in car after a meeting", "petting dog on couch"
- Subtle emotion: "slightly tired face", "knowing smile", "contemplative look"
- Low-effort actions: "walking while talking", "looking at phone then up", "closing laptop"
- NO elaborate staging: Don't suggest burning paper, empty wallets, or anything that requires props they don't have
```

**New:**
```
VISUAL HOOKS (what they see) - KEEP THESE SIMPLE AND ACTION-BASED:
- Everyday moments: "sitting at desk with messy coffee cup", "in car after a meeting", "petting dog on couch"
- Action-driven (NOT expression-based): "just sat down with coffee", "walking in from outside", "looking up from laptop", "mid-sip of drink", "setting phone down"
- Natural transitions: "leaning back in chair", "putting down a pen", "turning from window to camera"
- NO elaborate staging: Don't suggest burning paper, empty wallets, or anything that requires props they don't have
- NEVER ask for facial expressions: No "tired look", "knowing smile", "frustrated expression" - actions create natural expressions
```

### 2. Update Example Output (Lines 254-259)

**Current:**
```
"visual_hook": "Sitting in car after a meeting, slightly tired expression",
"visual_hook_options": [
  "Sitting in parked car, slightly tired expression",
  "Walking into your home office, coffee in hand",
  "At desk with natural lighting, end of day vibe"
],
```

**New:**
```
"visual_hook": "Sitting in parked car, just put the phone down",
"visual_hook_options": [
  "In parked car, just finishing a voice note",
  "Walking into home office, coffee in hand",
  "At desk, just closed your laptop"
],
```

### 3. Update delivery_style Example (Line 261)

**Current:**
```
"delivery_style": "Conversational, like debriefing with a friend after a long day. No acting required - just be real.",
```

**New:**
```
"delivery_style": "Like you're telling a friend about your day. Start mid-thought - no intro, no setup. Just talk.",
```

### 4. Update guidance Example (Line 276)

**Current:**
```
"guidance": "Record in your car or at your desk. Natural lighting. You're just telling a friend about a realization you had. No performance needed."
```

**New:**
```
"guidance": "Record in your car or at your desk. Natural lighting. Don't worry about how you look - just focus on what you're saying. Start talking before you hit record if it helps."
```

### 5. Add Explicit Anti-Acting Rule to System Prompt (after line 246)

Add a new section that explicitly bans expression-based directions:

```
=== CRITICAL: NO ACTING DIRECTIONS ===
NEVER include directions that require users to control their facial expression:
❌ "Look frustrated" → ✅ "Right after you check your email and see another rejection"
❌ "Show excitement" → ✅ "Mid-sentence when you realize the solution"
❌ "Tired expression" → ✅ "Just sat down after a long call"
❌ "Knowing smile" → ✅ "Right after taking a sip of coffee"
❌ "Express genuine [emotion]" → ✅ "Talk about a time when [situation]"

The visual hook should be a SITUATION or ACTION, never an expression to perform.
Authentic emotion comes from the memory/story, not from trying to look a certain way.
```

---

## Updated Visual Hook Options Template

Replace the niche-based visual hook options (Lines 193-198) with action-driven alternatives:

**Current:**
```
LOW-PRODUCTION VISUAL HOOK OPTIONS (always provide 2-3 alternatives):
Based on the user's niche, suggest EVERYDAY activities they might actually do:
- Coaches/consultants: "at your desk", "walking to car", "morning coffee", "post-meeting in hallway"
- Health/fitness: "post-workout", "in kitchen", "getting ready", "at the gym"
- Creatives: "at workspace", "with your tools", "mid-project", "studio background"
- Service providers: "between client calls", "checking emails", "end of day", "walking outside"
- General (always appropriate): "sitting in parked car", "petting your dog", "walking down stairs", "making coffee"
```

**New:**
```
LOW-PRODUCTION VISUAL HOOK OPTIONS (always provide 2-3 alternatives):
Use ACTION-BASED situations that create natural expressions without requiring performance:
- Just completed something: "just closed laptop", "just ended a call", "just put down your phone"
- Mid-routine: "mid-sip of coffee", "walking from one room to another", "getting settled at desk"
- Natural pauses: "looking up from work", "turning to camera from window", "about to leave"
- Everyday interrupts: "stopped mid-task", "remembered something", "just saw a message"

NICHE-SPECIFIC (action-based):
- Coaches/consultants: "just wrapped a client call", "between meetings", "reviewing notes"
- Health/fitness: "just finished a workout", "grabbing water", "stretching"
- Creatives: "stepping back from project", "cleaning brushes/tools", "taking a break"
- Service providers: "walking to next appointment", "checking schedule", "wrapping up paperwork"
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-creative-grid/index.ts` | Update visual hook examples, add anti-acting rule, revise example output, update niche-specific options |

---

## Summary

This update removes kitschy, expression-based directions and replaces them with action-based alternatives that:

1. **Don't require acting** - Users focus on what to DO, not how to LOOK
2. **Create natural expressions** - Actions like "just ended a frustrating call" produce authentic emotion
3. **Feel more professional** - Clear, actionable directions instead of vague emotion requests
4. **Are easier to execute** - Users know exactly where to stand and what to do
5. **Result in better content** - Authentic moments always outperform performed ones

Users will see directions like "In parked car, just put the phone down" instead of "In parked car, slightly tired expression" - much more natural and executable.

