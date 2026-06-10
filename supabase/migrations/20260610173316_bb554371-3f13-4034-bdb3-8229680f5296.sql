
-- 1. Lock down direct table SELECT: only admins may read user_reviews directly.
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.user_reviews;

-- 2. Revoke email column access from anon and authenticated as defense in depth.
REVOKE SELECT (email) ON public.user_reviews FROM anon;
REVOKE SELECT (email) ON public.user_reviews FROM authenticated;

-- 3. Public-safe view that excludes the email column.
CREATE OR REPLACE VIEW public.public_approved_reviews
WITH (security_invoker = true)
AS
SELECT id, reviewer_name, business_name, instagram_handle,
       approved_quote, review_text, rating, approved_at, status, created_at
FROM public.user_reviews
WHERE status = 'approved';

-- 4. Allow anon + authenticated to read the safe view; admins keep full table access.
GRANT SELECT ON public.public_approved_reviews TO anon, authenticated;

-- 5. Re-allow admins to SELECT email on the base table (admin ALL policy already exists).
GRANT SELECT ON public.user_reviews TO authenticated;
