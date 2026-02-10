

# Stronger Primary Copy Formatting + Copy Feedback Loop

## Overview

Three improvements:
1. **Primary copy spacing/formatting**: Update the AI prompt to enforce line breaks between thoughts, short paragraphs, and a strong opening hook line
2. **Stronger first line**: Add explicit instruction that the first line must be a powerful, scroll-stopping hook — standalone, punchy, and emotionally charged
3. **Wire up the feedback loop**: The `CopyRegenerateDialog` UI already exists and sends feedback, but the `generate-angle-copy` edge function completely ignores it. We need to accept the `feedback` parameter and inject it into the AI prompt so Lumi actually learns from user direction.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-angle-copy/index.ts` | (1) Accept `feedback` from request body. (2) Build a feedback context block from `quickSelections` and `additionalNotes` and inject it as high-priority direction in the user prompt. (3) Strengthen the primary copy formatting rules to emphasize spacing, line breaks between ideas, and a powerful opening hook. |

## Technical Details

### 1. Accept feedback parameter (line 15)

Add `feedback` to the destructured request body:
```ts
const { angles, brandInfo, offerData, audiencePsychology, brandId, offerId, offerAudiencePsychology, feedback } = await req.json();
```

### 2. Build feedback context block

After line 118, build a feedback injection string:
```ts
let feedbackContext = "";
if (feedback) {
  feedbackContext = "\n\n## USER FEEDBACK — HIGH PRIORITY DIRECTION\n";
  feedbackContext += "The user reviewed previous copy and wants these improvements:\n";
  if (feedback.quickSelections?.length) {
    const labels: Record<string, string> = {
      too_generic: "Copy feels too generic — make it more specific and unique",
      wrong_tone: "Tone doesn't match the brand — adjust voice",
      more_urgency: "Need more urgency and scarcity",
      focus_benefits: "Focus more on benefits and outcomes over features",
      shorter_copy: "Make it shorter and punchier",
      more_emotional: "Make it more emotional — connect with pain points and desires",
    };
    feedback.quickSelections.forEach((id: string) => {
      feedbackContext += `- ${labels[id] || id}\n`;
    });
  }
  if (feedback.additionalNotes) {
    feedbackContext += `\nUser's additional notes: "${feedback.additionalNotes}"\n`;
  }
  feedbackContext += "\nYou MUST apply this feedback. Generate noticeably different and improved copy.\n";
}
```

### 3. Inject feedback into user prompt

Prepend the `feedbackContext` to the `userPrompt` string so the AI sees it as priority direction.

### 4. Strengthen primary copy formatting rules

Update the `META BEST PRACTICES FOR PRIMARY COPY FORMATTING` section (around line 190) to be more explicit:

```
## META BEST PRACTICES FOR PRIMARY COPY FORMATTING
1. The FIRST LINE must be a powerful, scroll-stopping hook — standalone, punchy, emotionally charged. This is the most important line. It should make someone stop scrolling.
2. Add a BLANK LINE after the hook (line break)
3. Use SPACING to break up ideas — one thought per short paragraph (1-2 sentences max)
4. Add blank lines between paragraphs so the copy is easy to skim
5. For bullet lists, use consistent formatting:
   [emoji bullets or plain bullets]
6. End with a clear CTA on its own line, separated by a blank line
7. Total structure: Hook (line break) → Problem (line break) → Solution (line break) → Benefits (line break) → CTA
8. NEVER write walls of text. Every 1-2 sentences should have a line break.
9. Think of it like texting a friend — short bursts, not long paragraphs.
```

Also update the finalize-ad-copy edge function's formatting section to match these same rules for consistency.

