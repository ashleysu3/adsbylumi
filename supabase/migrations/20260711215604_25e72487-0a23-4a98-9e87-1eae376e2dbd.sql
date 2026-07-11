ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS ad_kit_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS ad_kit JSONB;

CREATE OR REPLACE FUNCTION public.get_ad_kit(p_kit_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_kit jsonb;
BEGIN
  IF p_kit_token IS NULL OR length(p_kit_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'brand_id', b.id,
    'name', b.name,
    'lead_name', b.lead_name,
    'ad_pack_image_url', b.ad_pack_image_url,
    'ad_kit', b.ad_kit,
    'audience_psychology', b.audience_psychology,
    'target_audience', b.target_audience
  ) INTO v_kit
  FROM public.brands b
  WHERE b.ad_kit_token = p_kit_token;

  RETURN v_kit;
END;
$$;