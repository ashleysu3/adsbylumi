INSERT INTO campaign_templates (
  name, slug, description, long_description, use_case, icon, objective, 
  optimization_event, audience_type, campaign_structure, sort_order, active,
  strategy_template, prepopulated_fields, kpi_benchmarks, kpi_priorities,
  journey_stages, budget_suggestion, purpose
) VALUES (
  'DM Leads Campaign',
  'dm-leads',
  'Drive DMs to your Instagram or Facebook using the Leads objective — let people message you directly from the ad',
  'Use Meta''s Leads objective with Messaging conversion location to drive direct messages from potential clients. Perfect for coaches, service providers, and creators who want to start conversations. Choose between Instagram DMs or Facebook Messenger, use existing posts or create new creative through the studio, and let Meta optimize for people most likely to message you.',
  'Service providers, coaches, and creators who convert through DM conversations',
  'MessageCircle',
  'Leads',
  'Lead',
  'Cold/Broad',
  '1 Leads campaign → 1 ad set → 6-10 ads (messaging conversion)',
  8,
  true,
  '{
    "campaign_type": "dm_leads",
    "dmLeadsCampaign": true,
    "conversionLocation": "instagram",
    "messaging_framework": {
      "approach": "Drive direct messages from cold/warm audiences who want to learn more or get started",
      "primary_goal": "Get qualified leads into DMs for conversation-based selling",
      "cta_type": "Send Message"
    },
    "audience_psychology": {
      "targeting": "Broad or interest-based",
      "rationale": "Let Meta find people most likely to start a conversation via DMs"
    },
    "optimization_goals": ["Maximum messaging leads", "Qualified DM conversations", "Low cost per messaging lead"],
    "allowExistingPosts": true,
    "allowCreativeStudio": true
  }'::jsonb,
  '{
    "optimizationEvent": {"value": "Lead", "skip": false},
    "conversionLocation": {"value": "messaging", "skip": false},
    "placements": {"value": "Advantage+ Placements", "skip": false}
  }'::jsonb,
  '{
    "cpl": {"min": 1.50, "max": 8.00, "label": "Cost per Messaging Lead"},
    "ctr": {"min": 1.0, "max": 3.0, "label": "Click-Through Rate"},
    "frequency": {"max": 4, "label": "Ad Frequency"}
  }'::jsonb,
  '["cpl", "messaging_conversations", "ctr"]'::jsonb,
  '["grow", "nurture", "convert"]'::jsonb,
  '$10-20/day',
  'Get qualified leads through Instagram DMs or Facebook Messenger conversations'
);