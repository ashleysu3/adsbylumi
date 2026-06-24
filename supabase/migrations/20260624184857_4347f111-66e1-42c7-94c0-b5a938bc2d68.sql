
-- 1) Feedback table
CREATE TABLE public.lead_quality_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.campaign_workspaces(id) ON DELETE CASCADE,
  campaign_id text,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  fit_rating text NOT NULL CHECK (fit_rating IN ('right','mixed','wrong')),
  reasons text[] NOT NULL DEFAULT '{}',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lqf_workspace ON public.lead_quality_feedback(workspace_id);
CREATE INDEX idx_lqf_brand ON public.lead_quality_feedback(brand_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_quality_feedback TO authenticated;
GRANT ALL ON public.lead_quality_feedback TO service_role;

ALTER TABLE public.lead_quality_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owner can view lead feedback"
  ON public.lead_quality_feedback FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()));

CREATE POLICY "Brand owner can insert lead feedback"
  ON public.lead_quality_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid())
  );

CREATE POLICY "Brand owner can update lead feedback"
  ON public.lead_quality_feedback FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()));

CREATE POLICY "Brand owner can delete lead feedback"
  ON public.lead_quality_feedback FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()));

-- 2) Knowledge base seed: attractor-signals taxonomy
INSERT INTO public.knowledge_documents (category, subcategory, title, tags, priority, content)
VALUES (
  'psychology',
  'audience_fit',
  'Audience fit — who your copy attracts',
  ARRAY['fit','attractor','audience','casting'],
  90,
$$# Audience fit — who your copy attracts

Every phrase in an ad is a casting call. The words decide who raises their hand. Most "bad leads" aren't a targeting problem; they're a copy problem — the ad cast the wrong character.

Before judging copy, anchor on **who the brand wants**: their ideal buyer, the offer's price/level, and the sophistication of the problem. Beginner/cheap framing is **only wrong for premium offers**. A real low-ticket / beginner offer should keep beginner-coded language — that's the right cast.

## Wrong-fit magnets (only "wrong" when they don't match the offer)

- **price-shopper** — "free", "cheapest", "save $X", "no cost", "low cost", "discount", "deal". Attracts deal-hunters; deadly on premium.
- **beginner** — "starting out", "brand new", "from scratch", "no experience needed", "anyone can do this". Attracts learners with no budget; only fine on starter offers.
- **tire-kicker** — "see if it's right for you", "no commitment", "just browse", "explore", "check it out". Attracts low-intent traffic.
- **overpromise** — "overnight", "guaranteed results", "secret", "loophole", "passive income while you sleep". Attracts cynics and skeptics who never buy.
- **vague-everyone** — "for anyone who wants more", "entrepreneurs", "creators", "coaches", "moms" with no qualifier. Attracts a stew of mismatched leads.

For each, look for the **exact leaking phrase** in the copy and quote it.

## Right-fit magnets (what to add for a higher-caliber buyer)

- **specificity** — exact role, channel, revenue range, niche. "Course creators at $5K/mo stuck under $10K."
- **identity / level markers** — "You've already…", "If you've launched and…", "Past the beginner stage of…". Names the stage.
- **investment framing** — "ready to invest", "serious about scaling", "willing to bet on yourself". Filters out browsers.
- **sophisticated problem** — names a problem only the right buyer would have. "Your funnel converts but cold traffic is 3x your warm CPL."
- **"not for you if"** — explicit repel line. "Not for you if you're still figuring out your offer."
- **proof of caliber** — clients/results that match the buyer's level, not impressive-to-anyone numbers.

## Scoring rule (A–F)

- **A** — voice is clearly cast for the ideal buyer; uses 2+ right-fit magnets; no leaking phrases.
- **B** — mostly aimed at the ideal buyer; 1 minor leaking phrase or missing repel line.
- **C** — mixed cast; a few right-fit signals but at least one strong wrong-fit magnet.
- **D** — copy mostly attracts the wrong cast; right buyer would scroll past.
- **F** — copy actively repels the ideal buyer and pulls in the worst-fit leads.

## How to re-aim copy

1. Confirm **who they want** from the brand's ideal-customer profile. If the profile is thin, ask — don't guess.
2. Quote each leaking phrase and name the wrong-fit magnet it triggers.
3. Replace with right-fit framing in the **same voice**, same offer, same length.
4. Add one gentle repel line ("not for you if…") when appropriate.
5. Flag creative mismatch separately (stock vibe / beginner aesthetic on premium offer, etc.).

## Calibration

Never judge blindly. A $27 starter template should sound beginner-friendly. A $5K mastermind should not. Score against the brand's stated ideal buyer + offer price, not a generic "premium" default.
$$
);
