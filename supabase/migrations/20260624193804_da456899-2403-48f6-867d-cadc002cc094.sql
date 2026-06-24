
-- Add lifecycle status + task_label to creatives.
-- Existing `status` column already stores 'unused' | 'used'. Migrate to:
--   working | ready | used | failed
-- 'unused' rows become 'ready'.

UPDATE public.creatives SET status = 'ready' WHERE status = 'unused' OR status IS NULL;

ALTER TABLE public.creatives
  ADD COLUMN IF NOT EXISTS task_label TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.creatives
  ALTER COLUMN status SET DEFAULT 'ready';

-- Replace any pre-existing status check constraint.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.creatives'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.creatives DROP CONSTRAINT %I', c);
  END LOOP;
END$$;

ALTER TABLE public.creatives
  ADD CONSTRAINT creatives_status_check
  CHECK (status IN ('working','ready','used','failed'));

CREATE INDEX IF NOT EXISTS idx_creatives_brand_status_created
  ON public.creatives (brand_id, status, created_at DESC);
