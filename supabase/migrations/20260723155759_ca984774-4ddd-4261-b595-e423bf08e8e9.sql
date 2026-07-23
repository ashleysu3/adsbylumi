DROP POLICY IF EXISTS "Admins manage all winback offers" ON public.winback_offers;

CREATE POLICY "Admins manage all winback offers"
  ON public.winback_offers
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
