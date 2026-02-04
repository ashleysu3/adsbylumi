-- Add agency mode to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_agency_user boolean DEFAULT false;

-- Index for efficient filtering
CREATE INDEX idx_profiles_agency ON public.profiles(is_agency_user) WHERE is_agency_user = true;