
ALTER TABLE public.recommended_strategies
  ADD COLUMN IF NOT EXISTS access_code text;

-- Normalize: uppercase + trim on write
CREATE OR REPLACE FUNCTION public.normalize_strategy_access_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.access_code IS NOT NULL THEN
    NEW.access_code := upper(trim(NEW.access_code));
    IF NEW.access_code = '' THEN
      NEW.access_code := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_strategy_access_code ON public.recommended_strategies;
CREATE TRIGGER trg_normalize_strategy_access_code
  BEFORE INSERT OR UPDATE ON public.recommended_strategies
  FOR EACH ROW EXECUTE FUNCTION public.normalize_strategy_access_code();

-- Unique among active strategies with a code
CREATE UNIQUE INDEX IF NOT EXISTS recommended_strategies_active_access_code_uniq
  ON public.recommended_strategies (access_code)
  WHERE access_code IS NOT NULL AND is_active = true;

-- Redemption RPC — returns the strategy or NULL
CREATE OR REPLACE FUNCTION public.redeem_strategy_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(coalesce(p_code, '')));
  v_row jsonb;
BEGIN
  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'slug', s.slug,
    'name', s.name,
    'description', s.description,
    'why_it_works', s.why_it_works,
    'campaigns', s.campaigns
  )
  INTO v_row
  FROM public.recommended_strategies s
  WHERE s.access_code = v_code
    AND s.is_active = true
  LIMIT 1;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_strategy_code(text) TO authenticated, anon;
