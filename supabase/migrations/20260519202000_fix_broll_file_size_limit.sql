-- Set an explicit file-size cap on the broll-library bucket so uploads up to
-- 250 MB succeed. The bucket was originally created without file_size_limit,
-- causing it to inherit the project default (lower than the 250 MB advertised
-- in the UI), which made any upload above that default fail server-side.
UPDATE storage.buckets
SET file_size_limit = 262144000   -- 250 MB in bytes
WHERE id = 'broll-library';
