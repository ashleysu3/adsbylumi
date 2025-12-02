-- Add prepopulated_fields column to campaign_templates
ALTER TABLE public.campaign_templates 
ADD COLUMN IF NOT EXISTS prepopulated_fields jsonb DEFAULT '{}';

-- Add RLS policies for admin management of templates
CREATE POLICY "Admins can insert templates" 
ON public.campaign_templates 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates" 
ON public.campaign_templates 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates" 
ON public.campaign_templates 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));