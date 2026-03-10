

## Plan: Email/Slack Report with LUMI Recommends + Rich Slack Formatting

### Two Changes

#### 1. Dual-Mode Report: Agency vs Self-Serve

The `generate-client-report` edge function currently generates reports for **agency users** sending to clients. You want the same report format reused for **self-serve email reports**, but with two key changes:

- **"What We're Doing About It"** → **"LUMI Recommends"**
- **Action items** split into:
  - Things the user does themselves (refresh creative, create new ads)
  - Things that need user approval for LUMI to execute (budget changes, pausing/enabling ads, swapping bench creative)

**Implementation:** Add a `mode` parameter to the edge function (`agency` vs `self-serve`). When `mode === 'self-serve'`:
- Replace "What We're Doing About It" with "LUMI Recommends"
- Replace "Agency Action Items" with "Your To-Do List" (creative tasks)
- Replace "What We Need From You" with "Approve These Changes" (budget/ad management actions LUMI can execute with approval)

The `send-weekly-reports` function will call `generate-client-report` with `mode: 'self-serve'` instead of using its own basic HTML template, so email recipients get the same beautiful AI-generated report.

#### 2. Rich Slack Formatting with Block Kit

Slack doesn't support HTML or markdown tables. Plain text loses all formatting. The solution is **Slack Block Kit** — Slack's native rich formatting system that supports headers, bold, bullet lists, dividers, and structured layouts.

**Implementation:** Add a `send-client-report-slack` edge function (or extend existing `send-optimization-digest`) that:
1. Takes the generated report text
2. Converts markdown sections into Slack Block Kit blocks:
   - `### Title` → `header` block
   - Tables → `section` blocks with `fields` (two-column key/value pairs)
   - Bullet lists → `section` with `mrkdwn`
   - `---` → `divider` block
   - Checklist items → formatted with ☐/☑ emoji
3. Sends via the Slack connector gateway using `chat.postMessage` with `blocks`

Add a "Send to Slack" button in the `ClientReportModal` that converts and sends the current report.

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-client-report/index.ts` | Accept `mode` param; swap section headers for self-serve |
| `supabase/functions/send-weekly-reports/index.ts` | Call `generate-client-report` with `mode: 'self-serve'` instead of building basic HTML |
| `supabase/functions/send-optimization-digest/index.ts` | Update `buildSlackMessage` to use Block Kit conversion for rich formatting |
| `src/components/insights/ClientReportModal.tsx` | Add "Send to Slack" button that sends the rendered report via the digest function |

