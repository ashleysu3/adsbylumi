
-- Table 1: client_portals
CREATE TABLE public.client_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.campaign_workspaces(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT null,
  access_code_hash text NOT NULL,
  portal_name text NOT NULL,
  client_name text,
  status text DEFAULT 'active',
  agency_branding jsonb DEFAULT '{}'::jsonb,
  items_included jsonb DEFAULT '[]'::jsonb
);

-- Validation trigger for status instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_client_portal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'revoked') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be active or revoked.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_client_portal_status
  BEFORE INSERT OR UPDATE ON public.client_portals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_client_portal_status();

-- RLS for client_portals
ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own portals"
  ON public.client_portals FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Owner can insert portals"
  ON public.client_portals FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner can update own portals"
  ON public.client_portals FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Owner can delete own portals"
  ON public.client_portals FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Table 2: client_portal_activity
CREATE TABLE public.client_portal_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid REFERENCES public.client_portals(id) ON DELETE CASCADE,
  production_item_id text NOT NULL,
  action text NOT NULL,
  comment text,
  client_name text,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for action
CREATE OR REPLACE FUNCTION public.validate_portal_activity_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action NOT IN ('viewed', 'approved', 'changes_requested') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be viewed, approved, or changes_requested.', NEW.action;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_portal_activity_action
  BEFORE INSERT OR UPDATE ON public.client_portal_activity
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_portal_activity_action();

-- RLS for client_portal_activity
ALTER TABLE public.client_portal_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select activity via portal"
  ON public.client_portal_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_portals
      WHERE client_portals.id = client_portal_activity.portal_id
        AND client_portals.created_by = auth.uid()
    )
  );

-- Security definer function for edge functions to validate portal access
CREATE OR REPLACE FUNCTION public.validate_portal_access(p_portal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', cp.id,
    'workspace_id', cp.workspace_id,
    'brand_id', cp.brand_id,
    'created_by', cp.created_by,
    'access_code_hash', cp.access_code_hash,
    'portal_name', cp.portal_name,
    'client_name', cp.client_name,
    'status', cp.status,
    'agency_branding', cp.agency_branding,
    'items_included', cp.items_included,
    'expires_at', cp.expires_at
  ) INTO v_portal
  FROM public.client_portals cp
  WHERE cp.id = p_portal_id;

  RETURN v_portal;
END;
$$;
