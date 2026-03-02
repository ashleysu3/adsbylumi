

## Plan: Add "Increase Comments/DMs" Campaign Template

### What It Is
A new campaign template for users running ManyChat-style autoresponders. The campaign gets existing Instagram posts in front of more people to drive comments and DMs. It uses Meta's Engagement objective with message destination, Instagram-only placement, and "Maximum Conversations" optimization.

### Changes

**1. Insert the campaign template into the database** (migration)

Insert a new row into `campaign_templates` with:
- **Name**: Increase Comments/DMs
- **Slug**: `comment-dm-engagement`
- **Description**: Best for autoresponder users (ManyChat) who want more eyes on content that triggers comments and DMs
- **Objective**: Engagement
- **Optimization Event**: Conversations (maximum number of conversations)
- **Audience**: Cold/Broad (fully broad)
- **Budget**: $10-15/day
- **Campaign Structure**: 1 Engagement campaign → 1 ad set → existing posts
- **Icon**: MessageCircle or similar
- **Prepopulated fields**: placements set to Instagram only (manual), multi-advertiser OFF, conversion location = message destinations
- **Strategy template**: includes messaging framework, psychology, and a flag (`useExistingPosts: true`) so the system knows to skip Creative Studio

**2. Add "Increase Comments/DMs" as a system offer option in Create.tsx**

Similar to the existing "Grow my Instagram following" system offer:
- Add a new system offer constant `COMMENT_DM_OFFER_ID = "system-comment-dm"`
- Add a new `StepOption` card: "Increase Comments/DMs" with a description like "Drive comments and DMs using your existing posts + autoresponder"
- When selected, show the same `SocialGrowthFlow` component (reuse it) to let users pick Instagram posts
- On complete, use the `comment-dm-engagement` template slug, create strategy + workspace with `commentDmCampaign: true` and `selectedPosts`, then redirect to `/campaigns/build?workspace=...` (same as social growth — no Creative Studio)

**3. Update SocialGrowthFlow.tsx (minor)**

The component currently passes back `objective: "video_views" | "traffic"`. For the comment/DM flow, we either:
- Pass a prop like `mode="comment-dm"` that skips the objective selector (since it's always Engagement/Conversations)
- Or add a third objective option

The simpler approach: pass a `defaultObjective` or `fixedObjective` prop so the flow just shows the post picker without asking about video views vs traffic.

**4. Wire up in CampaignBuilder (if needed)**

Check that the campaign builder handles `commentDmCampaign: true` workspaces correctly — it should use the template's prepopulated fields for Instagram-only manual placement, message destination, conversations optimization, and multi-advertiser OFF. This may already work if the builder reads from `strategy_json` / template fields.

### Files Changed
1. **Database migration** — insert new `campaign_templates` row
2. **`src/pages/Create.tsx`** — add system offer option + handler
3. **`src/components/SocialGrowthFlow.tsx`** — accept optional `fixedObjective` prop to skip objective selection
4. **`src/pages/admin/Templates.tsx`** — add "Conversations" to `optimizationEventOptions` so the template can be edited in admin
5. **`src/lib/campaign-kpi-config.ts`** — may need a config entry if Engagement doesn't already cover conversations KPIs

