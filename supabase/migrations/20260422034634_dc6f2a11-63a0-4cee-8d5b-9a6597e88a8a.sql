-- 1. Fix partner_access_tokens: drop the public/anon SELECT-all policy.
--    The remaining policies (admin SELECT, authenticated trial-code lookup) plus
--    the validate_partner_token RPC cover all real use cases.
DROP POLICY IF EXISTS "Anyone can validate tokens by select" ON public.partner_access_tokens;

-- 2. Restrict bug_reports INSERT to authenticated users to prevent anonymous spam.
DROP POLICY IF EXISTS "Admins can insert bug reports" ON public.bug_reports;

CREATE POLICY "Authenticated users can insert bug reports"
  ON public.bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Lock down broll-library storage bucket: keep files publicly readable
--    via direct public URL (needed for video playback in the app), but
--    remove the broad LIST/SELECT policy that allowed enumerating the bucket.
--    Object-level public read still works through getPublicUrl() because the
--    bucket's `public` flag stays true; we're only removing wildcard listing.
DROP POLICY IF EXISTS "Public read access for broll clips" ON storage.objects;

-- Re-add a tighter SELECT policy that allows authenticated owners to list
-- their own files (folder = brand_id), while public URL access continues to
-- work for anonymous viewers thanks to the bucket being marked public.
CREATE POLICY "Owners can list their broll clips"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'broll-library'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.brands WHERE user_id = auth.uid()
    )
  );