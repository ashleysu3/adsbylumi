UPDATE public.brands
SET instagram_account_id = NULL,
    instagram_account_name = NULL,
    updated_at = now()
WHERE id = '37be52d8-78e4-4a5d-80a2-2efe14f074a9'
  AND instagram_account_id = '17841408856733196';