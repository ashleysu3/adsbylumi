

## Plan: Rebrand Critical Alerts Email to Match Lumi Style

The critical alerts email currently uses a generic red/blue theme with system fonts. It needs to match the branded style established in the welcome and cancellation emails.

### Changes to `supabase/functions/send-critical-alerts/index.ts`

**Template updates (lines 250–339, `buildAlertEmailHtml` function):**

1. **Font**: Add `Red Hat Display` via Google Fonts import, apply across all text
2. **Background**: Change outer background from `#f5f5f5` to Lumi cream `#FAF9F6`
3. **Header**: Replace solid red gradient with Lumi's signature gradient (`#A78BFA → #EC4899 → #F97316`) — keep alert icon but soften the urgency to match brand tone
4. **Card styling**: Round corners to `16px`, add soft box-shadow matching other emails
5. **Alert cards**: Keep severity-based coloring (red for critical, amber for warning) but use Lumi-consistent border-radius and padding
6. **"What to do next" card**: Restyle with Lumi purple tones (`#F5F3FF` bg, `#A78BFA` border) instead of blue
7. **CTA button**: Replace blue gradient with Lumi gradient button (`#F97316 → #EC4899 → #A78BFA`), `border-radius: 12px`, matching welcome/cancellation emails
8. **Copy tone**: Warm up the greeting and action text to match Lumi voice — e.g., "Hey {name}," instead of "Hi {name}," and softer action language
9. **Footer**: Match cream background `#FAF9F6` with consistent font size and "Lumi by Ads by Lumi" branding
10. **CTA URL**: Update from `youradassistant.com` to `adsbylumi.com`

**Redeploy** the function after changes.

### No other files affected.

