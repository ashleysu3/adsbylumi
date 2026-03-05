
-- Create partner_applications table
CREATE TABLE public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  website text,
  audience_description text,
  promotion_plan text,
  how_will_you_share text,
  status text NOT NULL DEFAULT 'pending',
  application_type text NOT NULL,
  rewardful_affiliate_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (no auth required)
CREATE POLICY "Allow public inserts on partner_applications"
  ON public.partner_applications
  FOR INSERT
  WITH CHECK (true);

-- Admin can read all
CREATE POLICY "Admins can view all partner applications"
  ON public.partner_applications
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update
CREATE POLICY "Admins can update partner applications"
  ON public.partner_applications
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete
CREATE POLICY "Admins can delete partner applications"
  ON public.partner_applications
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
