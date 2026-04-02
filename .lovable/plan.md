

# Five Changes: CTA Explainer, Studio Button Labels, Universal Location, Lumi Escalation, Goal Wording

## 1. Add CTA explainer tooltip in Ad Preview

**File:** `src/components/AdPreview.tsx`

Next to the CTA button in the feed preview, add a small info icon with a tooltip (or a subtle note below the CTA) that explains two things:
- **Color**: "This button will match Meta's native CTA styling in your live ad — the color shown here is just our preview color and can't be customized."
- **Why this CTA**: "Your CTA was pre-selected as part of your campaign strategy. 'Learn More' drives clicks to your landing page, which is ideal for [objective]. Lumi chose this based on your campaign goal."

Pull the `cta` value and the workspace objective/template to show a dynamic reason. Add a `GlossaryTooltip`-style popover or a collapsible info card below the CTA button area.

Also add similar explainer in `src/components/creative/AdPreviewModal.tsx`.

## 2. Soften Creative Studio "Continue" button labels

**File:** `src/pages/CreativeStudio.tsx`

Replace the heavy "Continue to X" wording with lighter, friendlier labels:
- `"Continue to Ad Copy"` → `"See Ad Copy"` or `"View Ad Copy"`
- `"Continue to Build"` → `"Preview & Build"`
- `"Next Concept"` stays as-is (already light)

This affects the `getTopRightAction()` function (~lines 1122-1134) and the inline buttons (~lines 1487-1550).

## 3. Add universal location targeting to all campaigns

**File:** `src/components/CampaignBuilderForm.tsx`

Currently, location targeting only shows for template-based local strategies OR when smart detection fires. Change this to **always** show a "Where should your ad be shown?" section in the budget card area for all campaigns:

- Default country: "United States" (pre-selected)
- Allow adding additional countries from a simple list/autocomplete
- OR toggle to narrow down with address/city/state using existing `LocationAutocomplete`
- Move this above the Ad Schedule card so it sits right after budget
- Keep the existing smart-detection prompt as a secondary nudge if applicable

Also update `MobileCampaignBuilder.tsx` with the same universal location section.

## 4. Lumi escalation: "Did that help?" + help desk ticket

**Files:** `supabase/functions/lumi-chat/index.ts`, `src/components/LumiAssistant.tsx`

### Edge function changes:
In the system prompt, add a rule: after 3+ back-and-forth messages on the same topic without resolution (or if the user expresses continued confusion), the AI should include a `contact_support` action type alongside its response, asking "Did that help, or would you like to speak to a person?"

Add `'contact_support'` to the `type` enum in the tool schema (alongside `navigate` and `bug_report`).

### Frontend changes:
In `LumiAssistant.tsx`, handle the `contact_support` action type by opening a new **Help Ticket Modal** — reuse the `BugReportModal` component but with adjusted labels:
- Title: "Contact Support"
- Description placeholder: "Describe what you need help with..."
- Category: "help_request" instead of "bug"
- Still sends through the same `send-bug-report` edge function (or `manage-bug-report`) with a `type: 'help_request'` field so it routes through the same admin system

## 5. Change "book a call" goal wording

**File:** `src/pages/Create.tsx` (~line 852)

Change:
- Title: `"Get people to book a call with me"` → `"Get people to contact me"`
- Description: `"Fill your calendar with discovery calls or consultations"` → `"Drive inquiries through forms, calls, or applications"`

## Files Summary

| File | Change |
|------|--------|
| `src/components/AdPreview.tsx` | CTA explainer tooltip |
| `src/components/creative/AdPreviewModal.tsx` | CTA explainer tooltip |
| `src/pages/CreativeStudio.tsx` | Soften continue button labels |
| `src/components/CampaignBuilderForm.tsx` | Universal location targeting section |
| `src/components/MobileCampaignBuilder.tsx` | Universal location targeting section |
| `supabase/functions/lumi-chat/index.ts` | Add escalation logic + contact_support action |
| `src/components/LumiAssistant.tsx` | Handle contact_support action, open help ticket modal |
| `src/pages/Create.tsx` | Update "book a call" goal text |

