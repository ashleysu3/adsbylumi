DO $$
DECLARE v_req_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://sqwjbndgighjtifijgws.supabase.co/functions/v1/send-weekly-reports',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  ) INTO v_req_id;
  RAISE NOTICE 'weekly report request id: %', v_req_id;
END $$;