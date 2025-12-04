-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all brands
CREATE POLICY "Admins can view all brands" 
ON public.brands 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all campaign workspaces
CREATE POLICY "Admins can view all workspaces" 
ON public.campaign_workspaces 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all strategies
CREATE POLICY "Admins can view all strategies" 
ON public.strategies 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));