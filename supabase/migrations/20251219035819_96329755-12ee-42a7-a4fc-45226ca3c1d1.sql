-- Recreate pg_net extension in a non-public schema to satisfy the security linter
-- Note: pg_net does not support ALTER EXTENSION ... SET SCHEMA, so we drop + recreate.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP EXTENSION pg_net';
    EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
  END IF;
END $$;