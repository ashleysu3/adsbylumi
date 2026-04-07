
-- Team members table for brand-level collaboration
CREATE TABLE public.brand_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  invite_status TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'revoked')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(brand_id, user_id)
);

-- Enable RLS
ALTER TABLE public.brand_team_members ENABLE ROW LEVEL SECURITY;

-- Brand owner can do everything with their team members
CREATE POLICY "Brand owners can view team members"
  ON public.brand_team_members FOR SELECT
  TO authenticated
  USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Brand owners can insert team members"
  ON public.brand_team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
  );

CREATE POLICY "Brand owners can update team members"
  ON public.brand_team_members FOR UPDATE
  TO authenticated
  USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
  );

CREATE POLICY "Brand owners can delete team members"
  ON public.brand_team_members FOR DELETE
  TO authenticated
  USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
  );

-- Team members can view their own membership
CREATE POLICY "Team members can view own membership"
  ON public.brand_team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to accept an invite via token
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member RECORD;
  v_brand_name TEXT;
BEGIN
  -- Find the pending invite
  SELECT * INTO v_member
  FROM public.brand_team_members
  WHERE invite_token = p_token AND invite_status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite link');
  END IF;

  -- Check if user already has an accepted membership for this brand
  IF EXISTS (
    SELECT 1 FROM public.brand_team_members
    WHERE brand_id = v_member.brand_id AND user_id = auth.uid() AND invite_status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this team');
  END IF;

  -- Accept the invite
  UPDATE public.brand_team_members
  SET user_id = auth.uid(),
      invite_status = 'accepted',
      invite_token = NULL,
      updated_at = now()
  WHERE id = v_member.id;

  -- Get brand name
  SELECT name INTO v_brand_name FROM public.brands WHERE id = v_member.brand_id;

  RETURN jsonb_build_object('success', true, 'brand_name', v_brand_name, 'role', v_member.role);
END;
$$;
