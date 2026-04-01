
CREATE TABLE public.user_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewer_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  instagram_handle TEXT,
  website_url TEXT,
  email TEXT NOT NULL,
  review_text TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_quote TEXT,
  admin_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID
);

ALTER TABLE public.user_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a review (public insert)
CREATE POLICY "Anyone can submit reviews"
  ON public.user_reviews
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Admins can do everything
CREATE POLICY "Admins can manage all reviews"
  ON public.user_reviews
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can view approved reviews only
CREATE POLICY "Public can view approved reviews"
  ON public.user_reviews
  FOR SELECT
  TO public
  USING (status = 'approved');
