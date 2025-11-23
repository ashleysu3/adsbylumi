-- Add archive columns to offers table
ALTER TABLE offers 
ADD COLUMN archived boolean DEFAULT false,
ADD COLUMN archived_at timestamp with time zone;