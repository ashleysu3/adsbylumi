-- Admins can fully read partner_access_tokens
CREATE POLICY "Admins can view all partner tokens"
  ON partner_access_tokens FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow authenticated users to look up by partner_trial_code (for code validation on Sales page)
CREATE POLICY "Users can validate partner trial codes"
  ON partner_access_tokens FOR SELECT
  TO authenticated
  USING (partner_trial_code IS NOT NULL);