

## Align Weekly Email Reports with DIY Report + Add Email Approve Buttons

### What's Changing

The weekly email report currently shows detailed metrics (CTR, CPC, Frequency, Reach, Budget) and generic creative fatigue suggestions. The user wants it to mirror the DIY self-serve report — simpler metrics, consistent advice language, and actionable sections (budget overview, to-do list, approve buttons) directly in the email.

### Plan

**1. Update the `generate-client-report` AI prompt to exclude landing page and retargeting advice**

Add explicit rules to the prompt in `generate-client-report/index.ts`:
- "NEVER recommend landing page changes, landing page optimization, or A/B testing landing pages"
- "NEVER recommend retargeting campaigns or retargeting audiences — these are less effective due to Meta's Andromeda changes"
- These rules apply to both `self-serve` and `agency` modes

**2. Simplify the email campaign rows to match DIY report metrics**

In `send-weekly-reports/index.ts`, trim each campaign card to show only:
- **Ad Spend** (amount)
- **Key Metric** with goal (e.g., "CPL: $4.82 / Goal: < $6.00")
- **Results** count (leads, purchases, etc.)

Remove the current detailed metrics (CTR, CPC, Frequency, Reach, Budget per campaign). Keep the status emoji and "What's Happening" / "LUMI Recommends" sections.

**3. Add "What's Happening" and "LUMI Recommends" per campaign in the email**

Currently the email only shows status notes. Enhance it by using the `performance_report_latest` data from each workspace (which already contains the AI-generated report). Parse the "What's Happening" and "LUMI Recommends" sections from the stored report text and include them in the email under each campaign row.

**4. Add Budget Overview section to the email**

After all campaign rows, add a summary table showing each campaign's daily budget and total daily budget + total spend — mirroring the DIY report's budget overview.

**5. Add To-Do List section to the email**

Parse the stored report's "Your To-Do List" section and render it in the email. Each item gets a "Get Started →" link pointing to the relevant creative studio page.

**6. Add "Approve These Changes" section with working email buttons**

This is the most complex part. The approach:
- Parse the stored report's "Approve These Changes" items
- For each item, generate a unique approval token (UUID) and store it in a new `email_approval_tokens` table with the action details
- Render each item in the email with an "Approve" button that links to an edge function URL: `https://sqwjbndgighjtifijgws.supabase.co/functions/v1/approve-from-email?token=XXX`
- Create a new `approve-from-email` edge function that:
  1. Validates the token
  2. Inserts the action into `pending_optimizations` as approved
  3. Calls `apply-optimizations`
  4. Returns an HTML page showing success/failure
  5. Sends a follow-up confirmation email to the user with the result

**7. Exclude landing page and retargeting advice from email fatigue suggestions**

Update the hardcoded fatigue suggestions in the email function to never mention landing pages or retargeting. Keep suggestions focused on creative refreshes (new hooks, testimonials, cut-downs, etc.).

### Database Changes

New table: `email_approval_tokens`
- `id` UUID primary key
- `user_id` UUID (references profiles)
- `brand_id` UUID (references brands)
- `workspace_id` UUID nullable
- `action_description` text
- `token` text unique
- `status` text default 'pending' (pending/used/expired)
- `created_at` timestamptz
- `expires_at` timestamptz (7 days from creation)
- RLS: service role only (accessed by edge functions)

### New Edge Function

`approve-from-email/index.ts` — handles GET requests with a `token` param:
1. Look up token in `email_approval_tokens`
2. Validate not expired/used
3. Insert into `pending_optimizations`
4. Call `apply-optimizations`
5. Mark token as used
6. Send confirmation email via Resend
7. Return branded HTML success page

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-client-report/index.ts` | Add no-landing-page and no-retargeting rules to AI prompt |
| `supabase/functions/send-weekly-reports/index.ts` | Simplify metrics, add What's Happening/LUMI Recommends/Budget/To-Do/Approve sections; generate approval tokens; exclude landing page/retargeting advice from fatigue suggestions |
| `supabase/functions/approve-from-email/index.ts` | **New** — handles email approval clicks, executes action, sends confirmation |
| Database migration | Create `email_approval_tokens` table |

