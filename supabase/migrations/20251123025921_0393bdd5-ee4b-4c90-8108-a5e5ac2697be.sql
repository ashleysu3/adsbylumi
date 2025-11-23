-- Add meta_access_token column to brands table for storing OAuth token
ALTER TABLE public.brands 
ADD COLUMN meta_access_token text;

-- Add comment explaining the column
COMMENT ON COLUMN public.brands.meta_access_token IS 'Encrypted Meta OAuth access token for API calls';

-- Create index for faster lookups when token is present
CREATE INDEX idx_brands_meta_account ON public.brands(meta_account_id) WHERE meta_account_id IS NOT NULL;