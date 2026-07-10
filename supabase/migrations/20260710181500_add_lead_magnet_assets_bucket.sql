-- Genuinely public bucket for ad-pack images embedded in the lead-magnet
-- email — brand-assets is NOT public (confirmed live: its public URL
-- endpoint returns "Bucket not found" for unauthenticated requests, which
-- is Supabase Storage's way of masking a private bucket), so an <img> tag
-- in an email client (no Supabase session at all) would never load from
-- it. Follows the exact same pattern as the existing public
-- partner-assets bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-magnet-assets', 'lead-magnet-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lead magnet assets public read" ON storage.objects;
CREATE POLICY "Lead magnet assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lead-magnet-assets');

DROP POLICY IF EXISTS "Lead magnet assets owner write" ON storage.objects;
CREATE POLICY "Lead magnet assets owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-magnet-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
