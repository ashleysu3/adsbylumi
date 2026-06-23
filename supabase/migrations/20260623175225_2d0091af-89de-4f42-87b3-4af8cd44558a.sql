
ALTER TABLE public.campaign_templates
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'funnel',
  ADD COLUMN IF NOT EXISTS positioning_brief jsonb;

ALTER TABLE public.campaign_templates
  ALTER COLUMN strategy_template SET DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.campaign_templates
    ADD CONSTRAINT campaign_templates_type_check CHECK (type IN ('funnel','addon'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.campaign_templates
  (slug, name, description, long_description, use_case, purpose, icon, objective, optimization_event, audience_type,
   campaign_structure, budget_suggestion, strategy_template, active, sort_order, type, journey_stages, kpi_benchmarks, positioning_brief)
VALUES
('lead-magnet-cold','Lead Magnet — Free Resource',
 'Cold lead-gen to a free download with an optional small retarget of non-openers.',
 'Run a cold leads campaign to a free downloadable resource (guide, checklist, template, swipe file) and optionally retarget engagers and non-openers to lift opt-in rate.',
 'Build an email list by giving away a quick-win resource.',
 'lead_generation','Download','OUTCOME_LEADS','LEAD','broad',
 '1–2 campaigns: (1) Cold Leads → opt-in. (2) Optional retarget of engagers/non-openers.',
 '$20–60/day cold; $5–15/day optional retarget',
 '{}'::jsonb, true, 50, 'funnel',
 '[
   {"stage":"cold","name":"Cold Lead-Gen","objective":"OUTCOME_LEADS","optimization_event":"LEAD","role":"cold","required":true},
   {"stage":"retarget","name":"Retarget Non-Openers","objective":"OUTCOME_LEADS","optimization_event":"LEAD","role":"warm","required":false}
 ]'::jsonb,
 '{"primary_kpi":"cpl","cpl":{"min":2,"max":8,"unit":"USD"},"notes":"Judge on CPL and list quality, not immediate sales."}'::jsonb,
 '{"angle_intent":"low-friction, utility-first — lead with the specific quick win the resource delivers (\"grab the free [resource] that helps you [outcome]\")","awareness_level":"problem_aware","say":["free","instant","specific outcome"],"never_say":["buy","purchase","salesy pitch"]}'::jsonb),

('webinar-cold','Webinar / Free Training',
 'Cold registration campaign plus warm retarget of registrants who did not show or buy.',
 'Two-to-three campaigns: cold leads to a free live/evergreen training registration, then a warm retarget of registrants pushing the paid offer, with an optional value warm-up in front.',
 'Sell a paid offer via a free live or evergreen training.',
 'lead_generation','Video','OUTCOME_LEADS','LEAD','broad',
 '2–3 campaigns: (1) Cold Registration. (2) Retarget Registrants → Offer. (3) Optional value warm-up.',
 '$30–100/day cold; $10–30/day retarget; $10–20/day optional warm-up',
 '{}'::jsonb, true, 51, 'funnel',
 '[
   {"stage":"warmup","name":"Value Warm-Up (optional)","objective":"OUTCOME_ENGAGEMENT","optimization_event":"THRUPLAY","role":"cold","required":false},
   {"stage":"cold","name":"Cold Registration","objective":"OUTCOME_LEADS","optimization_event":"LEAD","role":"cold","required":true},
   {"stage":"retarget","name":"Retarget Registrants → Offer","objective":"OUTCOME_SALES","optimization_event":"PURCHASE","role":"sale","required":true}
 ]'::jsonb,
 '{"primary_kpi":"cpl","cpl":{"min":3,"max":12,"unit":"USD"},"secondary":["show_up_rate","sales_after_webinar"],"notes":"Cold KPI is CPL on registration; success is show-ups + sales from retarget."}'::jsonb,
 '{"angle_intent":"free live training on [specific result], save-your-seat, time-bound, teach/authority; retarget shifts to identity/FOMO/proof toward the offer","awareness_level":"problem_aware→solution_aware","say":["free live training","save your seat","learn how to [result]"],"never_say":["generic ''sign up''","pushy price talk on the cold ad"]}'::jsonb),

('paid-challenge-cold','Paid Challenge',
 'Cold sales for a low-ticket challenge plus a small retarget of page visitors and engagers.',
 'Two campaigns: cold sales for a low-ticket challenge (often feeding a continuity/MRR offer) and a small retarget of page visitors and engagers focused on proof, objections, and deadline.',
 'Convert cold traffic into low-ticket challenge buyers (often feeding continuity).',
 'sales','Trophy','OUTCOME_SALES','PURCHASE','broad',
 '2 campaigns: (1) Cold Sales — Challenge. (2) Retarget Visitors/Engagers.',
 '$40–120/day cold; $10–25/day retarget',
 '{}'::jsonb, true, 52, 'funnel',
 '[
   {"stage":"cold","name":"Cold Sales — Challenge","objective":"OUTCOME_SALES","optimization_event":"PURCHASE","role":"sale","required":true},
   {"stage":"retarget","name":"Retarget Visitors/Engagers","objective":"OUTCOME_SALES","optimization_event":"PURCHASE","role":"sale","required":false}
 ]'::jsonb,
 '{"primary_kpi":"cost_per_purchase","secondary":["roas"],"mrr_aware":true,"notes":"Do NOT require 1x+ first-purchase ROAS if challenge feeds a continuity/MRR offer."}'::jsonb,
 '{"angle_intent":"''[N]-day challenge to [specific result]'' — transformation + clear structure + low-risk price + start date urgency; retarget = proof/objection-handling/deadline","awareness_level":"problem_aware→solution_aware","say":["join the challenge","[N] days","starts [date]","low-risk"],"never_say":["vague ''program''","no urgency"]}'::jsonb),

('podcast-grow','Podcast — Grow + Capture',
 'Cold video views on the best podcast clips to build a warm pool, then retarget to follow/subscribe or opt into a companion resource.',
 'Two campaigns: cold video-views/engagement on the strongest podcast clips builds a warm viewer pool; retarget engaged viewers to follow the show and/or opt into a companion email resource. Podcast downloads are not trackable in Meta — judge on views, engagement, and pool built.',
 'Grow a podcast audience using Meta when downloads are not trackable.',
 'awareness','Mic','OUTCOME_ENGAGEMENT','THRUPLAY','broad',
 '2 campaigns: (1) Cold Clip Views. (2) Retarget Engaged Viewers → Lead/Follow.',
 '$20–60/day cold; $5–15/day retarget',
 '{}'::jsonb, true, 53, 'funnel',
 '[
   {"stage":"cold","name":"Cold Clip Views","objective":"OUTCOME_ENGAGEMENT","optimization_event":"THRUPLAY","role":"cold","required":true},
   {"stage":"retarget","name":"Retarget Engaged Viewers","objective":"OUTCOME_LEADS","optimization_event":"LEAD","role":"warm","required":false}
 ]'::jsonb,
 '{"primary_kpi":"cost_per_thruplay","secondary":["cost_per_engagement","cpm","cpl_on_retarget"],"notes":"Podcast downloads are NOT trackable in Meta — judge on video views, engagement, email captures, and pool built. Never judge on downloads."}'::jsonb,
 '{"angle_intent":"lead with the most curiosity-driving clip/hook/hot-take/guest authority; value/entertainment-first; retarget = ''loved that clip? follow the show / grab the [resource]''","awareness_level":"unaware→problem_aware","say":["the episode where...","listen","follow"],"never_say":["salesy","hard pitch"]}'::jsonb),

('dm-conversations','Direct Conversational Starters',
 'Messages-objective campaign driving prospects into IG/FB DMs to start a conversation.',
 'A Messages-objective campaign that drives qualified prospects into IG/FB DMs to start a conversation, with an optional small retarget of engagers/stalled conversations. Designed for high-ticket coaches and service providers — success is judged on booked calls and closes, not raw cost per conversation.',
 'High-ticket / service: start qualified DM conversations that convert to calls.',
 'dm_leads','MessageCircle','OUTCOME_ENGAGEMENT','CONVERSATIONS','broad',
 '1–2 campaigns: (1) Cold Messages. (2) Optional retarget of stalled convos.',
 '$20–80/day cold; $5–15/day optional retarget',
 '{}'::jsonb, true, 54, 'funnel',
 '[
   {"stage":"cold","name":"Cold Messages","objective":"OUTCOME_ENGAGEMENT","optimization_event":"CONVERSATIONS","role":"cold","required":true,"goal":"dm_leads"},
   {"stage":"retarget","name":"Retarget Stalled Convos","objective":"OUTCOME_ENGAGEMENT","optimization_event":"CONVERSATIONS","role":"warm","required":false}
 ]'::jsonb,
 '{"primary_kpi":"cost_per_conversation","notes":"Judge success on booked calls/closes from DMs, not raw cost-per-conversation. Higher cost is fine for high-ticket."}'::jsonb,
 '{"angle_intent":"invite a conversation with a clear low-friction value exchange (\"DM me [WORD] and I''ll send you [audit/spots/thing]\"); call out the exact person + outcome; qualify in the hook; CTA is a conversation not a purchase; lead with transformation + ''let''s see if it''s a fit'', not price","awareness_level":"solution_aware→product_aware","say":["DM me","let''s chat","see if it''s a fit"],"never_say":["price-led","buy-now"]}'::jsonb),

('warmup-social','Warm-Up',
 'Warms a cold audience and builds a retargeting pool. Test 3 variants: Traffic to profile, Engagement, Video Views.',
 'Add-on campaign that warms a cold audience and builds a retargeting pool. Test 2–3 variants in parallel (Traffic to IG/FB profile, Engagement on a post/page, Video Views) and keep whichever warms cheapest. Judged on cost-to-warm and pool size, not conversions.',
 'Add-on: build a warm pool cheaply before running conversion ads.',
 'awareness','Flame','OUTCOME_ENGAGEMENT','POST_ENGAGEMENT','broad',
 'Add-on. Test 2–3 variants in parallel (Traffic / Engagement / Video Views); keep whichever warms cheapest.',
 '$5–25/day per variant',
 '{}'::jsonb, true, 90, 'addon',
 '[
   {"stage":"warmup","name":"Warm-Up — Traffic to Profile","objective":"OUTCOME_TRAFFIC","optimization_event":"LINK_CLICKS","role":"cold","variant":"traffic"},
   {"stage":"warmup","name":"Warm-Up — Engagement","objective":"OUTCOME_ENGAGEMENT","optimization_event":"POST_ENGAGEMENT","role":"cold","variant":"engagement"},
   {"stage":"warmup","name":"Warm-Up — Video Views","objective":"OUTCOME_ENGAGEMENT","optimization_event":"THRUPLAY","role":"cold","variant":"video_views"}
 ]'::jsonb,
 '{"primary_kpi":"cost_to_warm","secondary":["cpm","cost_per_engagement","cost_per_thruplay"],"notes":"Judged on cost-to-warm + pool built, NOT conversions."}'::jsonb,
 '{"angle_intent":"value-first, educational, scroll-stopping, no hard CTA — teach/reframe/entertain","awareness_level":"unaware","say":["watch","learn","follow"],"never_say":["hard CTA","buy"]}'::jsonb),

('event-geo','Event / Geo',
 'Geo-targeted ad set on the main campaign, or a standalone geo''d awareness/engagement/traffic campaign around a venue.',
 'Add-on for in-person moments. Either add a geo-targeted ad set (location + radius + date window) to the main campaign, or run a standalone geo''d awareness/engagement/traffic campaign around a venue and retarget engagers toward an action.',
 'Add-on: capture an in-person moment (event, city, venue) and retarget toward an action.',
 'awareness','MapPin','OUTCOME_AWARENESS','REACH','custom_geo',
 'Add-on. Geo ad set on the main campaign OR standalone geo''d awareness/engagement/traffic with retarget of engagers.',
 '$15–50/day during event window',
 '{}'::jsonb, true, 91, 'addon',
 '[
   {"stage":"event","name":"Event/Geo Reach","objective":"OUTCOME_AWARENESS","optimization_event":"REACH","role":"cold","required":true,"geo":true},
   {"stage":"retarget","name":"Retarget Engagers → Action","objective":"OUTCOME_TRAFFIC","optimization_event":"LINK_CLICKS","role":"warm","required":false}
 ]'::jsonb,
 '{"primary_kpi":"cpm","secondary":["cost_per_engagement","cost_per_link_click"],"notes":"Judge on cheap geo reach + engagers captured for retarget."}'::jsonb,
 '{"angle_intent":"hyper-timely + location-aware (\"at [event]? come [do X]\", \"[city], we''re here this week\"); retarget continues the in-person moment toward an action","awareness_level":"problem_aware","say":["at [event]","[city]","this week"],"never_say":["generic national copy"]}'::jsonb)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  use_case = EXCLUDED.use_case,
  purpose = EXCLUDED.purpose,
  icon = EXCLUDED.icon,
  objective = EXCLUDED.objective,
  optimization_event = EXCLUDED.optimization_event,
  audience_type = EXCLUDED.audience_type,
  campaign_structure = EXCLUDED.campaign_structure,
  budget_suggestion = EXCLUDED.budget_suggestion,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  type = EXCLUDED.type,
  journey_stages = EXCLUDED.journey_stages,
  kpi_benchmarks = EXCLUDED.kpi_benchmarks,
  positioning_brief = EXCLUDED.positioning_brief;
