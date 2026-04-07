
-- Drop existing policies
DROP POLICY IF EXISTS "Owner can select own goals" ON public.campaign_goals;
DROP POLICY IF EXISTS "Owner can insert goals" ON public.campaign_goals;
DROP POLICY IF EXISTS "Owner can update own goals" ON public.campaign_goals;
DROP POLICY IF EXISTS "Owner can delete own goals" ON public.campaign_goals;

-- Recreate policies that allow brand owners (not just the goal creator) to access goals
CREATE POLICY "Brand owner can select goals"
ON public.campaign_goals FOR SELECT
USING (
  created_by = auth.uid()
  OR brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
);

CREATE POLICY "Brand owner can insert goals"
ON public.campaign_goals FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  OR brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
);

CREATE POLICY "Brand owner can update goals"
ON public.campaign_goals FOR UPDATE
USING (
  created_by = auth.uid()
  OR brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
);

CREATE POLICY "Brand owner can delete goals"
ON public.campaign_goals FOR DELETE
USING (
  created_by = auth.uid()
  OR brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
);
