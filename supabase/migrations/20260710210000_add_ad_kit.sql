-- The Ad Kit: token-gated public access to a lead's generated kit
-- (graphic, ad copy, talking-head script, strategy overview) at
-- /your-ad-pack?kit=<token>. The token is minted at email capture and
-- travels in the kit email, so the link works on any device with no
-- session — the email address is the only key that ever unlocks a kit.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS ad_kit_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS ad_kit JSONB;

-- Security definer lookup mirroring get_shared_report: RLS denies anon
-- SELECT on brands entirely, so the logged-out kit page reads through
-- this column whitelist only.
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
    'audience_psychology', b.audience_psychology
  ) INTO v_kit
  FROM public.brands b
  WHERE b.ad_kit_token = p_kit_token;

  RETURN v_kit;
END;
$$;
