-- Attribution for the stock footage source (e.g. Dupe Photo), so we can credit and
-- link back to them wherever a stock b-roll clip is surfaced to a user in-app.
ALTER TABLE public.stock_broll_clips
  ADD COLUMN credit_name text,
  ADD COLUMN credit_url text;
