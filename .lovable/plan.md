## Goal

Turn the partner welcome experience into a fully admin-configurable system. An admin fills out a form per partner (Ashley, future affiliates), gets a code, and anyone who signs up with that code automatically sees a custom welcome modal + gets recommended strategies/campaigns surfaced in their workspace.

## What gets built

### 1. Database changes (extend `partner_access_tokens`)

Add fields so each partner row is a full "welcome package":
- `welcome_message` (text) — custom message from the partner
- `partner_photo_url` (text) — headshot/logo
- `partner_title` (text) — e.g. "Wedding Industry Coach"
- `support_links` (jsonb) — array of `{ label, url, type }` (call booking, office hours, email, etc.)
- `recommended_strategies` (jsonb) — array of `{ title, description, template_slug? }` pointing at campaign templates to highlight
- `is_active` (boolean) — toggle without deleting
- Existing `perks` and `partner_display_name` stay

Update `get_partner_welcome` RPC to return all new fields.

New storage bucket `partner-assets` (public) for partner photos.

### 2. Admin dashboard page — `/admin/partners`

A new admin-only page (gated by `has_role(..., 'admin')`) with:
- Table of all partner codes (name, code, active toggle, signups count, edit/delete)
- "New partner" button → form drawer/modal
- Form fields:
  - Partner display name
  - Partner title (optional)
  - Trial code (auto-uppercased, validated unique)
  - Photo upload (to `partner-assets` bucket)
  - Custom welcome message (textarea)
  - Perks (repeatable list of `{ title, description, icon }`)
  - Support links (repeatable `{ label, url }` — for "Book your 1:1", "Join office hours", etc.)
  - Recommended strategies (repeatable `{ title, description }` + optional dropdown to pick from existing `campaign_templates`)
  - Active toggle
- Edit + delete existing partners
- Shows the shareable referral URL (`adsbylumi.com/?code=XXXXX`) with copy button

Linked from the existing admin sidebar/nav.

### 3. Updated `PartnerWelcomeModal`

Render the full custom package:
- Partner photo (circular) + name + title at top
- Custom welcome message
- Perks list (existing)
- **New: "Strategies Ashley recommends"** section — cards for each recommended strategy with title/description; if linked to a template, "Use this strategy" button routes to the planning flow with that template preselected
- **New: Support links** section — buttons for booking calls, office hours, etc.
- Falls back gracefully if any field is empty (so simple partners still work)

### 4. Recommended strategies surfaced beyond the modal

Store the partner code on the user's profile at signup (new column `profiles.partner_code`). On the Planning dashboard, if the user has a partner code with `recommended_strategies`, show a small "Recommended for you by {partner}" row above the template grid. This way the recommendations don't disappear after the modal closes.

### 5. Seed Ashley's data

Update Ashley's existing `ASHLEY` row with:
- Title: e.g. "Wedding Industry Strategist"
- Welcome message (placeholder you can edit)
- Photo (placeholder until you upload)
- Perks: 30-min 1:1 setup call + Monday 10am EST office hours (already there)
- Support links: Calendly link for the call, Google Meet link for office hours
- Recommended strategies: "Wedding Pro Strategy" + "Event Geo-Targeting Strategy"

## Technical notes

- All admin writes happen via direct table inserts/updates gated by RLS using `has_role(auth.uid(), 'admin')` — no edge function needed for CRUD.
- Photo upload uses Supabase Storage client directly.
- `recommended_strategies[].template_slug` (optional) joins to `campaign_templates.slug` so clicking "Use this strategy" can deep-link into the existing planner flow.
- `profiles.partner_code` is set in the same guest-checkout paths where we already call `setPartnerWelcomeCode` (`Sales.tsx`, `FreeTrial.tsx`) so the recommendation row persists after signup.

## Open questions before I build

1. For "Recommended strategies," do you want them to map to existing `campaign_templates` rows (so clicking opens the planner pre-filled), or are they just descriptive text cards for now?
2. Should the admin page live at `/admin/partners` and be linked from the existing admin nav, or somewhere else?
3. Anything else you want the admin form to capture (e.g. partner email, internal notes, commission %)?
