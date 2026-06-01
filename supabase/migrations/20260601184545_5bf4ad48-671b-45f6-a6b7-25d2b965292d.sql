-- Hide reviewer email from anonymous (public) readers of approved reviews.
-- The existing SELECT policy allows anon to read approved rows, but the email
-- column should not be exposed publicly. Column-level REVOKE blocks anon from
-- reading the email column while keeping the rest of the row visible.
REVOKE SELECT (email) ON public.user_reviews FROM anon;