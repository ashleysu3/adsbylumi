-- Add name column to waitlist table
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS name text;

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  max_uses integer DEFAULT 100,
  current_uses integer DEFAULT 0,
  active boolean DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active codes for validation during signup
CREATE POLICY "Anyone can validate active codes" ON public.invite_codes
  FOR SELECT USING (active = true);

-- Policy: Admins can manage all invite codes
CREATE POLICY "Admins can insert invite codes" ON public.invite_codes
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invite codes" ON public.invite_codes
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invite codes" ON public.invite_codes
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all codes (including inactive)
CREATE POLICY "Admins can view all codes" ON public.invite_codes
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));