UPDATE public.recommended_strategies
SET campaigns = '[
  {
    "goal": "grow_social",
    "name": "Educational awareness (top of funnel)",
    "audience": "Broad+",
    "objective": "OUTCOME_AWARENESS",
    "budget_pct": 40,
    "creative_brief": "Teach ONE useful thing in 30 seconds — no opt-in, no registration. Hook (specific pain or misconception) → quick insight or mini-lesson → soft CTA to follow for more. 30s talking-head with B-roll. Optimized for video views / cheap awareness, not leads."
  },
  {
    "goal": "promote_offer",
    "name": "Cold conversion",
    "audience": "Broad+",
    "objective": "OUTCOME_SALES",
    "budget_pct": 40,
    "creative_brief": "Offer-focused with proof: result clip, testimonial, before/after, CTA to your sales page."
  },
  {
    "goal": "promote_offer",
    "name": "Warm retargeting",
    "audience": "Engaged 30 days",
    "objective": "OUTCOME_SALES",
    "budget_pct": 20,
    "creative_brief": "Objection-handling: address the top 2-3 reasons people hesitate, then re-invite to buy."
  }
]'::jsonb
WHERE slug = 'coach-course-creator-3step';