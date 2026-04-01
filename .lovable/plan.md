

## Plan: Replace "Beta" with "Founder" Language Everywhere

### Summary
Remove all mentions of "beta", "beta tester", "beta pricing", "LUMIBETA" across the app and emails. Replace with "founder" language that communicates: this is a new platform, you're shaping it, bugs may happen, we want your feedback and feature requests.

---

### Files to Modify

#### 1. Sales Page (`src/pages/Sales.tsx`)
- **Line 476**: Change CTA from `Get Started — Code LUMIBETA` → `Get Started — Founder Pricing`
- **Line 477**: Change helper text from `Use code LUMIBETA at checkout for 50% off` → `Founder pricing — $97/mo. Lock in your rate before it goes up.`
- **Line 490**: Change final CTA from `Get Started — Code LUMIBETA` → `Get Started — Founder Pricing`
- Keep the locked-in rate callout as-is (lines 437-441) — it's already good.

#### 2. Welcome Email (`supabase/functions/send-beta-welcome-email/index.ts`)
- **Line 27**: Subject from `Welcome to the Lumi Beta, ${firstName} 🧪✨` → `Welcome to Lumi, ${firstName} — You're a Founding Member ✨`
- **Line 39-40**: Log type stays `beta_welcome` (internal, not user-facing)
- **Line 67-68**: Title from `Welcome to Lumi Beta` → `Welcome to Lumi`
- **Line 81**: Header from `You're a Lumi Beta Tester 🧪` → `You're a Lumi Founding Member ✨`
- **Line 82**: Subheader stays similar but remove "beta" reference
- **Lines 89-96**: Rewrite greeting to "founding member" tone — you're among the first, you're shaping the platform
- **Lines 99-136**: Rewrite "What being in beta means" → "What being a founding member means":
  - You're an early insider → keep but reword without "beta"
  - Bugs may happen → keep, reframe as "we're building fast and you may spot things before we do — let us know!"
  - Your voice matters → keep, add feature requests language
  - Keep the 1:1 campaign build call section
- **Line 183**: Footer from `signed up with a beta invite code` → `you're one of our founding members`

#### 3. Feedback Email (`supabase/functions/send-beta-feedback-email/index.ts`)
- **Line 81**: Header from `It's Been a Week! 🎉` → keep (no beta mention)
- This email is mostly clean. Just update footer line (~line near end): `You're receiving this because you're a beta tester` → `You're receiving this because you're a founding member`

#### 4. Feedback Request Cron (`supabase/functions/send-beta-feedback-requests/index.ts`)
- Console logs: change "beta users" → "founding members" (cosmetic, internal)
- No functional changes needed — it still queries `is_beta_user` column (internal DB field, not user-facing)

#### 5. Feedback Page (`src/pages/BetaFeedback.tsx`)
- **Line 90**: Title "How's your first week? 💭" → keep (no beta mention)
- Page content is already clean of beta language. No changes needed.

#### 6. Admin Pages (internal, keep `is_beta_user` DB references)
- `src/pages/admin/Users.tsx` line 1461: Change displayed text from `Resend the beta welcome email` → `Resend the founding member welcome email`
- `src/pages/admin/EmailLogs.tsx` line 25: Change label from `Beta Feedback` → `Founder Feedback`
- `src/pages/admin/InviteCodes.tsx` line 341: Change placeholder from `Beta Wave 1` → `Founding Wave 1`
- `src/pages/admin/DisputeEvidence.tsx`: Already says "Founding Member" — no change needed.

#### 7. Cancel Subscription Modal (`src/components/CancelSubscriptionModal.tsx`)
- **Line 191**: Already says "Founding member pricing" — no change needed. ✅

#### 8. General Welcome Email (`supabase/functions/send-welcome-email/index.ts`)
- Already clean — no beta references. ✅

### What NOT to change
- Database column names (`is_beta_user`, `beta_feedback_email_sent`, `beta_feedback` table) — these are internal and renaming would require migrations with no user benefit
- Edge function names (`send-beta-welcome-email`, `send-beta-feedback-email`) — renaming would break existing cron jobs and admin triggers

### Tone guidance for rewritten copy
- "You're a founding member" not "beta tester"
- "You're helping shape what Lumi becomes" 
- "This is a brand new platform — you may run into bugs, and that's okay. Here's how to let us know."
- "We'd love your feature requests"
- "We're thrilled you're here from the beginning"
- No mention of "beta" anywhere in user-facing text

