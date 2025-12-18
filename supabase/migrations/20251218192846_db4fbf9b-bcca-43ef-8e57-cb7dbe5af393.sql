-- Add page_goal column to offers table
ALTER TABLE public.offers 
ADD COLUMN page_goal text;