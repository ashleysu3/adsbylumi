-- Create campaign_templates table
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  use_case TEXT NOT NULL,
  long_description TEXT NOT NULL,
  icon TEXT NOT NULL,
  objective TEXT NOT NULL,
  optimization_event TEXT,
  audience_type TEXT NOT NULL,
  campaign_structure TEXT NOT NULL,
  budget_suggestion TEXT,
  strategy_template JSONB NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

-- Public read access for templates
CREATE POLICY "Templates are viewable by everyone"
ON public.campaign_templates FOR SELECT
USING (active = true);

-- Insert the 6 campaign templates
INSERT INTO public.campaign_templates (name, slug, description, use_case, long_description, icon, objective, optimization_event, audience_type, campaign_structure, budget_suggestion, strategy_template) VALUES
(
  'Webinar Sign Ups',
  'webinar-signups',
  'Generate more registrations for your live training or workshop.',
  'Live trainings, workshops, masterclasses',
  'Use this when you''re promoting a live webinar, workshop, challenge, or masterclass and want to collect registrations.',
  'Video',
  'Leads',
  'Lead',
  'Cold/Broad',
  '1 ABO campaign → 1 ad set → 8–12 ads',
  '$20-50/day minimum',
  '{
    "campaign_type": "cold",
    "messaging_framework": {
      "core_message": "Transform your knowledge into authority by hosting a live event that positions you as the expert.",
      "hooks": [
        "Are you ready to [achieve desired outcome] in just [timeframe]?",
        "Join me for a free live training where I''ll show you...",
        "What if you could finally [solve pain point] without [objection]?"
      ],
      "psychological_levers": ["Authority", "Social proof", "Scarcity", "Transformation"]
    },
    "audience_psychology": {
      "pain_points": ["Stuck and need guidance", "Want expert help", "Looking for proven system"],
      "desires": ["Fast results", "Clear roadmap", "Expert guidance"],
      "objections": ["Time commitment", "Will this work for me", "Cost"]
    },
    "optimization_goals": ["CPL under $15", "Registration rate above 25%", "Cost per registration $5-12"],
    "kpi_benchmarks": {
      "ctr": "2-3%",
      "cpc": "$0.50-$1.50",
      "cpl": "$5-$15"
    },
    "placements": "Advantage+ (automatic)",
    "budget_optimization": "ABO",
    "creative_mix": "8-12 ads: mix of talking head videos, static graphics, and testimonials"
  }'
),
(
  'Lead Magnet Downloads',
  'lead-magnet',
  'Grow your email list with a high-value checklist, guide, or PDF.',
  'Checklists, guides, PDFs, cheat sheets',
  'Use this when you want to grow your list using a checklist, guide, blueprint, quiz, or template.',
  'FileText',
  'Leads',
  'Lead',
  'Cold/Broad',
  '1 ABO campaign → 1 ad set → 8–12 ads',
  '$15-40/day minimum',
  '{
    "campaign_type": "cold",
    "messaging_framework": {
      "core_message": "Provide immediate value through a high-quality resource that solves a specific problem.",
      "hooks": [
        "Download my free [resource] that helped [social proof]",
        "Get instant access to the exact [tool/system] I use to [result]",
        "Grab this free [resource] before [scarcity element]"
      ],
      "psychological_levers": ["Instant gratification", "Value demonstration", "Reciprocity", "Social proof"]
    },
    "audience_psychology": {
      "pain_points": ["Need quick wins", "Want actionable steps", "Overwhelmed by options"],
      "desires": ["Simple solution", "Proven template", "Fast implementation"],
      "objections": ["Quality concerns", "Time to implement", "Is it really free"]
    },
    "optimization_goals": ["CPL under $8", "Landing page conversion 30%+", "Cost per download $3-8"],
    "kpi_benchmarks": {
      "ctr": "2.5-4%",
      "cpc": "$0.40-$1.20",
      "cpl": "$3-$10"
    },
    "placements": "Advantage+ (automatic)",
    "budget_optimization": "ABO",
    "creative_mix": "8-12 ads: previews of the resource, transformation stories, and direct offers"
  }'
),
(
  'Low Ticket Product Sales',
  'low-ticket-sales',
  'Run profitable ads to your $7–$47 digital product.',
  '$7–$47 offers',
  'Use this to test sales angles or drive revenue for offers under $50.',
  'ShoppingCart',
  'Sales',
  'Purchase',
  'Cold/Warm',
  '1 cold campaign + optional warm retargeting',
  '$30-75/day cold, $10-20/day warm',
  '{
    "campaign_type": "cold",
    "messaging_framework": {
      "core_message": "Low-risk, high-value offer that delivers immediate transformation at an accessible price point.",
      "hooks": [
        "For less than [price comparison], you can [transformation]",
        "What if [desired outcome] only cost you [price]?",
        "Stop [pain point] and start [desired state] today"
      ],
      "psychological_levers": ["Low barrier to entry", "Value demonstration", "Urgency", "Guarantee"]
    },
    "audience_psychology": {
      "pain_points": ["Can''t afford expensive solutions", "Want to test before committing", "Need immediate access"],
      "desires": ["Quick wins", "Affordable solution", "Proven system"],
      "objections": ["Will it work", "Is it worth it", "What if I fail"]
    },
    "optimization_goals": ["ROAS 2:1 minimum", "CPP under $20", "Conversion rate 2%+"],
    "kpi_benchmarks": {
      "ctr": "2-3%",
      "cpc": "$0.50-$1.80",
      "cpp": "$10-$25",
      "roas": "2:1 to 5:1"
    },
    "placements": "Advantage+ (automatic)",
    "budget_optimization": "ABO for cold, Warm retargeting separate",
    "creative_mix": "Cold: 8-12 ads with benefit-focused hooks. Warm: 4-6 testimonial/urgency ads"
  }'
),
(
  'Discovery Call / Application',
  'discovery-call',
  'Book more qualified calls from your warm audience.',
  'High-ticket service calls or consultations',
  'Use this when you sell coaching/services and want more qualified calls booked.',
  'PhoneCall',
  'Leads',
  'Lead',
  'Warm (Engaged 30d + website + IG/FB)',
  '1 warm campaign → 1-2 ad sets → 6-10 ads',
  '$25-60/day',
  '{
    "campaign_type": "warm",
    "messaging_framework": {
      "core_message": "Build trust with warm audiences and make it easy to book a conversation about their specific situation.",
      "hooks": [
        "Ready to talk about [achieving goal]? Let''s chat.",
        "If you''ve been following along and wondering if this could work for you...",
        "I only work with [qualification criteria]. If that''s you, let''s talk."
      ],
      "psychological_levers": ["Exclusivity", "Authority", "Trust", "Qualification"]
    },
    "audience_psychology": {
      "pain_points": ["Unsure if they qualify", "Worried about sales pressure", "Need custom solution"],
      "desires": ["Personal attention", "Tailored solution", "Expert guidance"],
      "objections": ["Time commitment", "Cost concerns", "Will I be sold to"]
    },
    "optimization_goals": ["CPL under $25", "Call show rate 60%+", "Cost per booked call $15-30"],
    "kpi_benchmarks": {
      "ctr": "3-5%",
      "cpc": "$0.80-$2.00",
      "cpl": "$15-$35"
    },
    "placements": "Advantage+ (automatic)",
    "budget_optimization": "ABO",
    "creative_mix": "6-10 ads: warm trust-building content, case studies, and direct call invitations"
  }'
),
(
  'Traffic to Instagram/Facebook',
  'social-traffic',
  'Send more people to your IG/FB profile using posts you already have.',
  'Increasing reach, warming audience, evergreen content',
  'Use this when you want visibility and engagement on posts you''ve already created.',
  'TrendingUp',
  'Traffic',
  'Profile Visits',
  'Cold/Broad',
  '1 traffic campaign → 1-2 ad sets → Must use existing posts',
  '$10-30/day',
  '{
    "campaign_type": "training",
    "messaging_framework": {
      "core_message": "Leverage your best existing content to build awareness and warm audiences at low cost.",
      "hooks": [
        "See what everyone is talking about...",
        "This is exactly what [target audience] needs to know",
        "Your feed is missing this"
      ],
      "psychological_levers": ["Curiosity", "FOMO", "Social proof", "Value demonstration"]
    },
    "audience_psychology": {
      "pain_points": ["Don''t know you exist", "Scrolling without purpose", "Looking for solutions"],
      "desires": ["Valuable content", "Entertainment", "Learn something new"],
      "objections": ["Is this spam", "Why should I care", "Too much time"]
    },
    "optimization_goals": ["CPC under $0.30", "Profile visit rate 15%+", "CPM under $10"],
    "kpi_benchmarks": {
      "ctr": "1.5-3%",
      "cpc": "$0.15-$0.50",
      "profile_visits": "15-25%"
    },
    "placements": "Advantage+ (automatic)",
    "budget_optimization": "ABO",
    "creative_mix": "Use existing posts: educational content, testimonials, behind-the-scenes"
  }'
),
(
  'Video Views Campaign',
  'video-views',
  'Grow warm audiences for future launches with low-cost video views.',
  'Building warm audiences cheaply and fast',
  'Use this when you''re building warm audiences for future launches or long-term retargeting.',
  'Play',
  'Engagement',
  '2s ThruPlay',
  'Cold/Broad',
  '1 engagement campaign → 1-2 ad sets → 6-10 video ads',
  '$10-25/day',
  '{
    "campaign_type": "training",
    "messaging_framework": {
      "core_message": "Build massive warm audiences at the lowest possible cost by optimizing for video engagement.",
      "hooks": [
        "Here''s what nobody tells you about [topic]...",
        "Watch this if you''re serious about [goal]",
        "I''m going to show you exactly how [result]"
      ],
      "psychological_levers": ["Curiosity", "Education", "Authority building", "Value first"]
    },
    "audience_psychology": {
      "pain_points": ["Information overload", "Don''t know where to start", "Skeptical of claims"],
      "desires": ["Learn from expert", "Get clarity", "See proof"],
      "objections": ["Too long", "Not relevant", "Seen it before"]
    },
    "optimization_goals": ["CPM under $8", "2s view rate 40%+", "Cost per ThruPlay $0.02-0.05"],
    "kpi_benchmarks": {
      "ctr": "2-4%",
      "cpm": "$5-$12",
      "thruplays": "$0.01-$0.08"
    },
    "placements": "Advantage+ (automatic)",
    "budget_optimization": "ABO",
    "creative_mix": "6-10 videos: educational hooks, story-based content, transformation testimonials"
  }'
);

-- Add offer details to strategies table for the new flow
ALTER TABLE public.strategies
ADD COLUMN IF NOT EXISTS offer_name TEXT,
ADD COLUMN IF NOT EXISTS offer_url TEXT,
ADD COLUMN IF NOT EXISTS offer_price TEXT,
ADD COLUMN IF NOT EXISTS offer_description TEXT,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.campaign_templates(id);
