
-- Allow admins to insert offers for any brand
CREATE POLICY "Admins can insert offers"
ON public.offers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all offers
CREATE POLICY "Admins can view all offers"
ON public.offers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update all offers
CREATE POLICY "Admins can update all offers"
ON public.offers
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete all offers
CREATE POLICY "Admins can delete all offers"
ON public.offers
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
