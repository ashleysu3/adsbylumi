
-- Add admin bypass policies for campaign_workspaces (UPDATE, INSERT, DELETE)
CREATE POLICY "Admins can update all workspaces"
  ON public.campaign_workspaces
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert workspaces for any brand"
  ON public.campaign_workspaces
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all workspaces"
  ON public.campaign_workspaces
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
